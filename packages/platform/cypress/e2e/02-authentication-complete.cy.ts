/**
 * Complete Authentication Flow E2E Test
 * Tests login, signup, forgot password, and dev mode flows with comprehensive coverage
 */

describe('Authentication Complete Flow Test', () => {
  beforeEach(() => {
    // Clear any existing auth state
    cy.clearCookies();
    cy.clearLocalStorage();
    cy.window().then((win) => {
      win.sessionStorage.clear();
    });

    // Set up interceptors for unauthenticated state
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 401,
      body: { error: 'Unauthorized' },
    }).as('unauthenticated');
  });

  it('Login Page - Complete Flow Test', () => {
    cy.log('🔐 Testing Complete Login Flow');

    // ==========================================
    // STEP 1: Visit Login Page
    // ==========================================
    cy.log('📋 Step 1: Visit Login Page');

    cy.visit('/auth/login', { failOnStatusCode: false });

    // Verify page structure
    cy.get('[data-cy="login-page"]').should('be.visible');
    cy.get('[data-cy="login-title"]')
      .should('be.visible')
      .and('contain.text', 'Log in to your account');
    cy.get('[data-cy="login-form"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Form Elements
    // ==========================================
    cy.log('📝 Step 2: Test Form Elements');

    // Test email input
    cy.get('[data-cy="email-input"]').should('be.visible');
    cy.get('[data-cy="email-input"] input').should(
      'have.attr',
      'type',
      'email',
    );
    cy.get('[data-cy="email-input"] input').should('have.attr', 'required');

    // Test password input
    cy.get('[data-cy="password-input"]').should('be.visible');
    cy.get('[data-cy="password-input"] input').should(
      'have.attr',
      'type',
      'password',
    );
    cy.get('[data-cy="password-input"] input').should('have.attr', 'required');

    // Test forgot password link
    cy.get('[data-cy="forgot-password-link"]').should('be.visible');
    cy.get('[data-cy="forgot-password-link"]').should(
      'have.attr',
      'href',
      '/auth/forgot-password',
    );

    // Test submit button (should be disabled initially)
    cy.get('[data-cy="login-submit-button"]').should('be.visible');
    cy.get('[data-cy="login-submit-button"]').should('be.disabled');

    // Test signup link
    cy.get('[data-cy="signup-link"]').should('be.visible');
    cy.get('[data-cy="signup-link"]').should(
      'have.attr',
      'href',
      '/auth/signup',
    );

    // ==========================================
    // STEP 3: Test Form Validation
    // ==========================================
    cy.log('✅ Step 3: Test Form Validation');

    // Submit button should be disabled with empty fields
    cy.get('[data-cy="login-submit-button"]').should('be.disabled');

    // Fill only email
    cy.get('[data-cy="email-input"] input').type('test@example.com');
    cy.get('[data-cy="login-submit-button"]').should('be.disabled');

    // Fill password too
    cy.get('[data-cy="password-input"] input').type('password123');
    cy.get('[data-cy="login-submit-button"]').should('not.be.disabled');

    // Clear email, button should be disabled again
    cy.get('[data-cy="email-input"] input').clear();
    cy.get('[data-cy="login-submit-button"]').should('be.disabled');

    // ==========================================
    // STEP 4: Test Successful Login
    // ==========================================
    cy.log('✅ Step 4: Test Successful Login');

    // Fill form again
    cy.get('[data-cy="email-input"] input').type('test@elizaos.ai');
    cy.get('[data-cy="password-input"] input').type('validpassword123');

    // Mock successful login
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          user: {
            id: 'login-test-user',
            email: 'test@elizaos.ai',
            firstName: 'Test',
            lastName: 'User',
            role: 'owner',
          },
          organization: {
            id: 'login-test-org',
            name: 'Test Organization',
            slug: 'test-org',
          },
          tokens: {
            accessToken: 'login-access-token',
            refreshToken: 'login-refresh-token',
          },
        },
      },
    }).as('loginRequest');

    // Mock post-login identity check
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        user: {
          id: 'login-test-user',
          email: 'test@elizaos.ai',
          firstName: 'Test',
          lastName: 'User',
          role: 'owner',
          emailVerified: true,
        },
        organization: {
          id: 'login-test-org',
          name: 'Test Organization',
          slug: 'test-org',
        },
      },
    }).as('postLoginIdentity');

    // Submit form
    cy.get('[data-cy="login-submit-button"]').click();
    cy.wait('@loginRequest');

    // Should redirect to dashboard
    cy.url().should('include', '/dashboard');
    cy.wait('@postLoginIdentity');

    // ==========================================
    // STEP 5: Test Login Error Handling
    // ==========================================
    cy.log('❌ Step 5: Test Login Error Handling');

    cy.visit('/auth/login', { failOnStatusCode: false });

    // Fill form with invalid credentials
    cy.get('[data-cy="email-input"] input').type('invalid@example.com');
    cy.get('[data-cy="password-input"] input').type('wrongpassword');

    // Mock failed login
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 401,
      body: {
        success: false,
        error: {
          code: 'invalid_credentials',
          message: 'Invalid email or password',
        },
      },
    }).as('loginError');

    cy.get('[data-cy="login-submit-button"]').click();
    cy.wait('@loginError');

    // Should stay on login page
    cy.url().should('include', '/auth/login');
    cy.get('[data-cy="login-page"]').should('be.visible');

    // ==========================================
    // STEP 6: Test Development Mode
    // ==========================================
    cy.log('🔧 Step 6: Test Development Mode');

    // Dev mode should be visible in Cypress environment
    cy.get('[data-cy="dev-mode-section"]').should('be.visible');
    cy.get('[data-cy="dev-login-btn"]').should('be.visible');

    // Mock dev login
    cy.intercept('POST', '**/api/auth/dev-login', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          user: {
            id: 'dev-user-123',
            email: 'dev@elizaos.ai',
            firstName: 'Developer',
            lastName: 'User',
            role: 'owner',
          },
          organization: {
            id: 'dev-org-123',
            name: 'ElizaOS Development',
            slug: 'elizaos-dev',
          },
          message: 'Developer login successful',
        },
      },
    }).as('devLoginRequest');

    // Test dev login button
    cy.get('[data-cy="dev-login-btn"]').click();
    cy.wait('@devLoginRequest');

    // Dev login uses window.location.href, so we can't easily test the redirect
    // but we can verify the request was made

    cy.log('✅ Login Page Complete Flow Test Finished!');
  });

  it('Signup Page - Complete Flow Test', () => {
    cy.log('📝 Testing Complete Signup Flow');

    // ==========================================
    // STEP 1: Visit Signup Page
    // ==========================================
    cy.log('📋 Step 1: Visit Signup Page');

    cy.visit('/auth/signup', { failOnStatusCode: false });

    // Verify page structure
    cy.get('[data-cy="signup-page"]').should('be.visible');
    cy.get('[data-cy="signup-title"]')
      .should('be.visible')
      .and('contain.text', 'Get started with your dashboard');
    cy.get('[data-cy="signup-subtitle"]')
      .should('be.visible')
      .and('contain.text', 'Free for 14 days');
    cy.get('[data-cy="signup-form"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Form Elements
    // ==========================================
    cy.log('📝 Step 2: Test Form Elements');

    // Test first name input
    cy.get('[data-cy="firstName-input"]').should('be.visible');
    cy.get('[data-cy="firstName-input"] input').should('have.attr', 'required');

    // Test last name input (optional)
    cy.get('[data-cy="lastName-input"]').should('be.visible');
    cy.get('[data-cy="lastName-input"] input').should(
      'not.have.attr',
      'required',
    );

    // Test email input
    cy.get('[data-cy="email-input"]').should('be.visible');
    cy.get('[data-cy="email-input"] input').should(
      'have.attr',
      'type',
      'email',
    );
    cy.get('[data-cy="email-input"] input').should('have.attr', 'required');

    // Test organization input
    cy.get('[data-cy="organizationName-input"]').should('be.visible');
    cy.get('[data-cy="organizationName-input"] input').should(
      'have.attr',
      'required',
    );

    // Test password input
    cy.get('[data-cy="password-input"]').should('be.visible');
    cy.get('[data-cy="password-input"] input').should(
      'have.attr',
      'type',
      'password',
    );
    cy.get('[data-cy="password-input"] input').should('have.attr', 'required');

    // Test submit button (should be disabled initially)
    cy.get('[data-cy="signup-submit-button"]').should('be.visible');
    cy.get('[data-cy="signup-submit-button"]').should('be.disabled');

    // Test login link
    cy.get('[data-cy="login-link"]').should('be.visible');
    cy.get('[data-cy="login-link"]').should('have.attr', 'href', '/auth/login');

    // ==========================================
    // STEP 3: Test Form Validation
    // ==========================================
    cy.log('✅ Step 3: Test Form Validation');

    // Submit button should be disabled with empty required fields
    cy.get('[data-cy="signup-submit-button"]').should('be.disabled');

    // Fill required fields one by one
    cy.get('[data-cy="firstName-input"] input').type('John');
    cy.get('[data-cy="signup-submit-button"]').should('be.disabled');

    cy.get('[data-cy="email-input"] input').type('john@company.com');
    cy.get('[data-cy="signup-submit-button"]').should('be.disabled');

    cy.get('[data-cy="organizationName-input"] input').type('Test Company');
    cy.get('[data-cy="signup-submit-button"]').should('be.disabled');

    cy.get('[data-cy="password-input"] input').type('securepassword123');
    cy.get('[data-cy="signup-submit-button"]').should('not.be.disabled');

    // Optional last name
    cy.get('[data-cy="lastName-input"] input').type('Doe');

    // ==========================================
    // STEP 4: Test Successful Signup
    // ==========================================
    cy.log('✅ Step 4: Test Successful Signup');

    // Mock successful signup
    cy.intercept('POST', '**/api/auth/signup', {
      statusCode: 201,
      body: {
        success: true,
        data: {
          user: {
            id: 'signup-test-user',
            email: 'john@company.com',
            firstName: 'John',
            lastName: 'Doe',
            role: 'owner',
          },
          organization: {
            id: 'signup-test-org',
            name: 'Test Company',
            slug: 'test-company',
          },
          tokens: {
            accessToken: 'signup-access-token',
            refreshToken: 'signup-refresh-token',
          },
        },
      },
    }).as('signupRequest');

    // Mock post-signup identity check
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        user: {
          id: 'signup-test-user',
          email: 'john@company.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'owner',
          emailVerified: true,
        },
        organization: {
          id: 'signup-test-org',
          name: 'Test Company',
          slug: 'test-company',
        },
      },
    }).as('postSignupIdentity');

    // Submit form
    cy.get('[data-cy="signup-submit-button"]').click();
    cy.wait('@signupRequest');

    // Should redirect to dashboard
    cy.url().should('include', '/dashboard');
    cy.wait('@postSignupIdentity');

    // ==========================================
    // STEP 5: Test Signup Error Handling
    // ==========================================
    cy.log('❌ Step 5: Test Signup Error Handling');

    cy.visit('/auth/signup', { failOnStatusCode: false });

    // Fill form with duplicate email
    cy.get('[data-cy="firstName-input"] input').type('Jane');
    cy.get('[data-cy="lastName-input"] input').type('Smith');
    cy.get('[data-cy="email-input"] input').type('existing@company.com');
    cy.get('[data-cy="organizationName-input"] input').type('Another Company');
    cy.get('[data-cy="password-input"] input').type('password123');

    // Mock failed signup (email already exists)
    cy.intercept('POST', '**/api/auth/signup', {
      statusCode: 409,
      body: {
        success: false,
        error: 'Email already exists',
      },
    }).as('signupError');

    cy.get('[data-cy="signup-submit-button"]').click();
    cy.wait('@signupError');

    // Should stay on signup page
    cy.url().should('include', '/auth/signup');
    cy.get('[data-cy="signup-page"]').should('be.visible');

    // ==========================================
    // STEP 6: Test Development Mode Signup
    // ==========================================
    cy.log('🔧 Step 6: Test Development Mode Signup');

    // Dev mode should be visible in Cypress environment
    cy.get('[data-cy="dev-mode-section"]').should('be.visible');
    cy.get('[data-cy="dev-signup-btn"]').should('be.visible');

    // Mock dev signup
    cy.intercept('POST', '**/api/auth/dev-login', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          user: {
            id: 'dev-signup-user-123',
            email: 'dev@elizaos.ai',
            firstName: 'Developer',
            lastName: 'User',
            role: 'owner',
          },
          organization: {
            id: 'dev-signup-org-123',
            name: 'ElizaOS Development',
            slug: 'elizaos-dev',
          },
        },
      },
    }).as('devSignupRequest');

    // Test dev signup button
    cy.get('[data-cy="dev-signup-btn"]').click();
    cy.wait('@devSignupRequest');

    cy.log('✅ Signup Page Complete Flow Test Finished!');
  });

  it('Authentication Navigation Flow Test', () => {
    cy.log('🧭 Testing Authentication Navigation Flow');

    // ==========================================
    // STEP 1: Login to Signup Navigation
    // ==========================================
    cy.log('🔄 Step 1: Login to Signup Navigation');

    cy.visit('/auth/login', { failOnStatusCode: false });

    // Click signup link
    cy.get('[data-cy="signup-link"]').click();
    cy.url().should('include', '/auth/signup');
    cy.get('[data-cy="signup-page"]').should('be.visible');

    // ==========================================
    // STEP 2: Signup to Login Navigation
    // ==========================================
    cy.log('🔄 Step 2: Signup to Login Navigation');

    // Click login link
    cy.get('[data-cy="login-link"]').click();
    cy.url().should('include', '/auth/login');
    cy.get('[data-cy="login-page"]').should('be.visible');

    // ==========================================
    // STEP 3: Forgot Password Navigation
    // ==========================================
    cy.log('🔄 Step 3: Forgot Password Navigation');

    // Test forgot password link
    cy.get('[data-cy="forgot-password-link"]').should(
      'have.attr',
      'href',
      '/auth/forgot-password',
    );

    // We can test the href attribute but don't need to navigate since
    // forgot password page might not exist yet

    cy.log('✅ Authentication Navigation Flow Test Finished!');
  });

  it('Authentication Responsive Design Test', () => {
    cy.log('📱 Testing Authentication Responsive Design');

    // ==========================================
    // STEP 1: Test Login Page Mobile
    // ==========================================
    cy.log('📱 Step 1: Test Login Page Mobile');

    cy.viewport('iphone-x');
    cy.visit('/auth/login', { failOnStatusCode: false });

    // All elements should be visible on mobile
    cy.get('[data-cy="login-page"]').should('be.visible');
    cy.get('[data-cy="login-form"]').should('be.visible');
    cy.get('[data-cy="email-input"]').should('be.visible');
    cy.get('[data-cy="password-input"]').should('be.visible');
    cy.get('[data-cy="login-submit-button"]').should('be.visible');
    cy.get('[data-cy="signup-link"]').should('be.visible');

    // Dev mode should also be visible on mobile
    cy.get('[data-cy="dev-mode-section"]').should('be.visible');

    // ==========================================
    // STEP 2: Test Signup Page Mobile
    // ==========================================
    cy.log('📱 Step 2: Test Signup Page Mobile');

    cy.visit('/auth/signup', { failOnStatusCode: false });

    // All elements should be visible on mobile
    cy.get('[data-cy="signup-page"]').should('be.visible');
    cy.get('[data-cy="signup-form"]').should('be.visible');
    cy.get('[data-cy="firstName-input"]').should('be.visible');
    cy.get('[data-cy="lastName-input"]').should('be.visible');
    cy.get('[data-cy="email-input"]').should('be.visible');
    cy.get('[data-cy="organizationName-input"]').should('be.visible');
    cy.get('[data-cy="password-input"]').should('be.visible');
    cy.get('[data-cy="signup-submit-button"]').should('be.visible');
    cy.get('[data-cy="login-link"]').should('be.visible');

    // Two-column name inputs should stack on mobile
    cy.get('[data-cy="firstName-input"]').should('be.visible');
    cy.get('[data-cy="lastName-input"]').should('be.visible');

    // ==========================================
    // STEP 3: Test Tablet Viewport
    // ==========================================
    cy.log('📱 Step 3: Test Tablet Viewport');

    cy.viewport('ipad-2');
    cy.visit('/auth/login', { failOnStatusCode: false });

    // Should still be fully functional on tablet
    cy.get('[data-cy="login-page"]').should('be.visible');
    cy.get('[data-cy="login-form"]').should('be.visible');

    cy.visit('/auth/signup', { failOnStatusCode: false });
    cy.get('[data-cy="signup-page"]').should('be.visible');
    cy.get('[data-cy="signup-form"]').should('be.visible');

    // Reset to desktop
    cy.viewport(1280, 720);

    cy.log('✅ Authentication Responsive Design Test Finished!');
  });

  it('Authentication Form Interaction Test', () => {
    cy.log('⌨️ Testing Authentication Form Interactions');

    // ==========================================
    // STEP 1: Test Keyboard Navigation
    // ==========================================
    cy.log('⌨️ Step 1: Test Keyboard Navigation');

    cy.visit('/auth/login', { failOnStatusCode: false });

    // Tab through form elements
    cy.get('[data-cy="email-input"] input').focus();
    cy.get('[data-cy="email-input"] input').type('test@example.com');
    cy.get('[data-cy="email-input"] input').tab();

    // Should focus on password field
    cy.get('[data-cy="password-input"] input').should('be.focused');
    cy.get('[data-cy="password-input"] input').type('password123');

    // Tab to submit button
    cy.get('[data-cy="password-input"] input').tab();
    cy.get('[data-cy="login-submit-button"]').should('be.focused');

    // ==========================================
    // STEP 2: Test Enter Key Submission
    // ==========================================
    cy.log('⌨️ Step 2: Test Enter Key Submission');

    // Mock login request
    cy.intercept('POST', '**/api/auth/login', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          user: { id: 'test-user', email: 'test@example.com' },
          organization: { id: 'test-org', name: 'Test Org' },
          tokens: { accessToken: 'token', refreshToken: 'refresh' },
        },
      },
    }).as('enterKeyLogin');

    // Mock post-login identity
    cy.intercept('GET', '**/api/auth/identity', {
      statusCode: 200,
      body: {
        user: {
          id: 'test-user',
          email: 'test@example.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'owner',
          emailVerified: true,
        },
        organization: { id: 'test-org', name: 'Test Org' },
      },
    }).as('postEnterKeyIdentity');

    // Press Enter in password field to submit
    cy.get('[data-cy="password-input"] input').focus();
    cy.get('[data-cy="password-input"] input').type('{enter}');
    cy.wait('@enterKeyLogin');

    // Should redirect
    cy.url().should('include', '/dashboard');

    // ==========================================
    // STEP 3: Test Signup Form Interactions
    // ==========================================
    cy.log('⌨️ Step 3: Test Signup Form Interactions');

    cy.visit('/auth/signup', { failOnStatusCode: false });

    // Fill all fields via keyboard
    cy.get('[data-cy="firstName-input"] input').type('John');
    cy.get('[data-cy="firstName-input"] input').tab();

    cy.get('[data-cy="lastName-input"] input').should('be.focused');
    cy.get('[data-cy="lastName-input"] input').type('Doe');
    cy.get('[data-cy="lastName-input"] input').tab();

    cy.get('[data-cy="email-input"] input').should('be.focused');
    cy.get('[data-cy="email-input"] input').type('john.doe@company.com');
    cy.get('[data-cy="email-input"] input').tab();

    cy.get('[data-cy="organizationName-input"] input').should('be.focused');
    cy.get('[data-cy="organizationName-input"] input').type('Test Company');
    cy.get('[data-cy="organizationName-input"] input').tab();

    cy.get('[data-cy="password-input"] input').should('be.focused');
    cy.get('[data-cy="password-input"] input').type('securepassword123');

    // Submit button should be enabled
    cy.get('[data-cy="signup-submit-button"]').should('not.be.disabled');

    cy.log('✅ Authentication Form Interaction Test Finished!');
  });
});
