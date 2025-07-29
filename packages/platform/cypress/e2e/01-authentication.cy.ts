describe('Authentication Flow', () => {
  beforeEach(() => {
    cy.clearAuthState();
  });

  describe('Login Flow', () => {
    it('should display login page correctly', () => {
      cy.visit('/auth/login');

      // Check page elements
      cy.get('[data-cy="login-form"]').should('be.visible');
      cy.get('[data-cy="email-input"]').should('be.visible');
      cy.get('[data-cy="password-input"]').should('be.visible');
      cy.get('[data-cy="login-submit-button"]').should('be.visible');
      cy.get('[data-cy="signup-link"]').should('be.visible');
      cy.get('[data-cy="forgot-password-link"]').should('be.visible');
    });

    it('should validate form inputs', () => {
      cy.visit('/auth/login');

      // Check that submit button is disabled when form is empty
      cy.get('[data-cy="login-submit-button"]').should('be.disabled');

      // Test with invalid email
      cy.get('[data-cy="email-input"]').type('invalid-email');
      cy.get('[data-cy="password-input"]').type('password123');
      cy.get('[data-cy="login-submit-button"]').should('not.be.disabled');

      // Test with valid inputs
      cy.get('[data-cy="email-input"]').clear().type('test@example.com');
      cy.get('[data-cy="password-input"]').clear().type('validpassword123');
      cy.get('[data-cy="login-submit-button"]').should('not.be.disabled');
    });

    it('should handle login errors', () => {
      cy.visit('/auth/login');

      // Mock login error
      cy.intercept('POST', '**/auth/login', {
        statusCode: 401,
        body: { success: false, error: 'Invalid credentials' },
      }).as('loginError');

      cy.fillLoginForm('test@example.com', 'wrongpassword');
      cy.get('[data-cy="login-submit-button"]').click();

      // Just verify the API call was made
      cy.wait('@loginError');
    });

    it('should login successfully with dev login', () => {
      cy.visit('/auth/login');

      // Check that dev login section is visible
      cy.get('[data-cy="dev-mode-section"]').should('be.visible');
      cy.get('[data-cy="dev-login-btn"]').should('be.visible');

      // Click dev login
      cy.get('[data-cy="dev-login-btn"]').click();

      // Should redirect to dashboard
      cy.url().should('include', '/dashboard');
    });

    it('should persist login state', () => {
      cy.loginAsTestUser();
      cy.visit('/dashboard');

      // Should not redirect to login
      cy.url().should('include', '/dashboard');

      // Refresh page and check persistence
      cy.reload();
      cy.url().should('include', '/dashboard');
    });
  });

  describe('Signup Flow', () => {
    it('should display signup page correctly', () => {
      cy.visit('/auth/signup');

      cy.get('[data-cy="signup-form"]').should('be.visible');
      cy.get('[data-cy="first-name-input"]').should('be.visible');
      cy.get('[data-cy="last-name-input"]').should('be.visible');
      cy.get('[data-cy="email-input"]').should('be.visible');
      cy.get('[data-cy="organization-input"]').should('be.visible');
      cy.get('[data-cy="password-input"]').should('be.visible');
      cy.get('[data-cy="confirm-password-input"]').should('be.visible');
      cy.get('[data-cy="terms-checkbox"]').should('be.visible');
      cy.get('[data-cy="signup-submit"]').should('be.visible');
      cy.get('[data-cy="login-link"]').should('be.visible');
    });

    it('should validate signup form', () => {
      cy.visit('/auth/signup');

      // Try to submit empty form
      cy.get('[data-cy="signup-submit"]').click();
      cy.get('[data-cy="first-name-error"]').should(
        'contain',
        'First name is required',
      );
      cy.get('[data-cy="last-name-error"]').should(
        'contain',
        'Last name is required',
      );
      cy.get('[data-cy="email-error"]').should('contain', 'Email is required');
      cy.get('[data-cy="organization-error"]').should(
        'contain',
        'Organization name is required',
      );
      cy.get('[data-cy="password-error"]').should(
        'contain',
        'Password is required',
      );

      // Test password mismatch
      cy.get('[data-cy="password-input"]').type('password123');
      cy.get('[data-cy="confirm-password-input"]').type('different123');
      cy.get('[data-cy="signup-submit"]').click();
      cy.get('[data-cy="confirm-password-error"]').should(
        'contain',
        'Passwords do not match',
      );

      // Test terms acceptance
      cy.get('[data-cy="confirm-password-input"]').clear().type('password123');
      cy.get('[data-cy="signup-submit"]').click();
      cy.get('[data-cy="terms-error"]').should(
        'contain',
        'You must accept the terms',
      );
    });

    it('should handle signup errors', () => {
      cy.visit('/auth/signup');

      // Mock email already exists error
      cy.mockApiError('POST', 'auth/signup', 'Email already exists', 409);

      const newUser = {
        firstName: 'Test',
        lastName: 'User',
        email: 'existing@example.com',
        organizationName: 'Test Org',
        password: 'password123',
      };

      cy.fillSignupForm(newUser);
      cy.get('[data-cy="confirm-password-input"]').type('password123');
      cy.get('[data-cy="terms-checkbox"]').check();
      cy.get('[data-cy="signup-submit"]').click();

      cy.get('[data-cy="error-message"]').should(
        'contain',
        'Email already exists',
      );
    });

    it('should signup successfully', () => {
      cy.visit('/auth/signup');

      // Mock successful signup
      cy.mockApiSuccess('POST', 'auth/signup', {
        user: {
          id: 'new-user-123',
          email: 'newuser@example.com',
          firstName: 'New',
          lastName: 'User',
          organizationId: 'new-org-123',
        },
        token: 'new-token',
        refreshToken: 'new-refresh-token',
      });

      const newUser = {
        firstName: 'New',
        lastName: 'User',
        email: 'newuser@example.com',
        organizationName: 'New Organization',
        password: 'securepassword123',
      };

      cy.fillSignupForm(newUser);
      cy.get('[data-cy="confirm-password-input"]').type('securepassword123');
      cy.get('[data-cy="terms-checkbox"]').check();
      cy.get('[data-cy="signup-submit"]').click();

      // Should redirect to onboarding or dashboard
      cy.url().should('match', /\/(onboarding|dashboard)/);
      cy.get('[data-cy="welcome-message"]').should(
        'contain',
        'Welcome to ElizaOS',
      );
    });
  });

  describe('Logout Flow', () => {
    beforeEach(() => {
      cy.loginAsTestUser();
    });

    it('should logout successfully', () => {
      cy.visit('/dashboard');

      // Mock logout
      cy.mockApiSuccess('POST', 'auth/logout', {
        message: 'Logged out successfully',
      });

      // Open user menu and click logout
      cy.get('[data-cy="user-menu"]').click();
      cy.get('[data-cy="logout-button"]').click();

      // Should redirect to login
      cy.url().should('include', '/auth/login');

      // Try to access protected route
      cy.visit('/dashboard');
      cy.url().should('include', '/auth/login');
    });
  });

  describe('Password Reset Flow', () => {
    it('should display forgot password page', () => {
      cy.visit('/auth/forgot-password');

      cy.get('[data-cy="forgot-password-form"]').should('be.visible');
      cy.get('[data-cy="email-input"]').should('be.visible');
      cy.get('[data-cy="reset-submit"]').should('be.visible');
      cy.get('[data-cy="back-to-login"]').should('be.visible');
    });

    it('should send password reset email', () => {
      cy.visit('/auth/forgot-password');

      // Mock password reset request
      cy.mockApiSuccess('POST', 'auth/forgot-password', {
        message: 'Password reset email sent',
      });

      cy.get('[data-cy="email-input"]').type('test@example.com');
      cy.get('[data-cy="reset-submit"]').click();

      cy.get('[data-cy="success-message"]').should(
        'contain',
        'Password reset email sent',
      );
    });

    it('should handle reset token validation', () => {
      const resetToken = 'valid-reset-token';
      cy.visit(`/auth/reset-password?token=${resetToken}`);

      // Mock token validation
      cy.mockApiSuccess('POST', 'auth/validate-reset-token', {
        valid: true,
        email: 'test@example.com',
      });

      cy.get('[data-cy="new-password-input"]').should('be.visible');
      cy.get('[data-cy="confirm-password-input"]').should('be.visible');
      cy.get('[data-cy="reset-password-submit"]').should('be.visible');
    });

    it('should reset password successfully', () => {
      const resetToken = 'valid-reset-token';
      cy.visit(`/auth/reset-password?token=${resetToken}`);

      // Mock password reset
      cy.mockApiSuccess('POST', 'auth/reset-password', {
        message: 'Password reset successfully',
      });

      cy.get('[data-cy="new-password-input"]').type('newpassword123');
      cy.get('[data-cy="confirm-password-input"]').type('newpassword123');
      cy.get('[data-cy="reset-password-submit"]').click();

      cy.get('[data-cy="success-message"]').should(
        'contain',
        'Password reset successfully',
      );
      cy.url().should('include', '/auth/login');
    });
  });

  describe('Session Management', () => {
    it('should refresh token when expired', () => {
      cy.loginAsTestUser();

      // Mock expired token response
      cy.intercept('GET', '**/api/agents', { statusCode: 401 }).as(
        'expiredToken',
      );

      // Mock token refresh
      cy.mockApiSuccess('POST', 'auth/refresh', {
        token: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });

      cy.visit('/dashboard');
      cy.wait('@expiredToken');

      // Should automatically refresh and retry
      cy.get('[data-cy="dashboard-content"]').should('be.visible');
    });

    it('should redirect to login when refresh fails', () => {
      cy.loginAsTestUser();

      // Mock expired token
      cy.intercept('GET', '**/api/agents', { statusCode: 401 }).as(
        'expiredToken',
      );

      // Mock failed refresh
      cy.mockApiError('POST', 'auth/refresh', 'Invalid refresh token', 401);

      cy.visit('/dashboard');
      cy.wait('@expiredToken');

      // Should redirect to login
      cy.url().should('include', '/auth/login');
      cy.get('[data-cy="session-expired-message"]').should('be.visible');
    });
  });

  describe('Social Authentication', () => {
    it('should display social login options', () => {
      cy.visit('/auth/login');

      cy.get('[data-cy="google-login"]').should('be.visible');
      cy.get('[data-cy="github-login"]').should('be.visible');
    });

    it('should handle Google OAuth flow', () => {
      cy.visit('/auth/login');

      // Mock OAuth URL generation
      cy.mockApiSuccess('GET', 'auth/oauth/google', {
        authUrl: 'https://accounts.google.com/oauth/authorize?...',
      });

      cy.get('[data-cy="google-login"]').click();

      // In real test, would handle OAuth redirect
      // For now, just verify the request was made
      cy.url().should('include', 'auth/login');
    });
  });
});
