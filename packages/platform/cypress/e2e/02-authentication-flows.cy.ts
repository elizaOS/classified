describe('Authentication Flows - Complete Test Suite', () => {
  beforeEach(() => {
    cy.clearCookies();
    cy.clearLocalStorage();
  });

  describe('Login Page', () => {
    beforeEach(() => {
      cy.visit('/auth/login');
    });

    it('should display login page correctly', () => {
      cy.url().should('include', '/auth/login');

      // Check page structure
      cy.get('form').should('be.visible');
      cy.get('input[type="email"]').should('be.visible');
      cy.get('input[type="password"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');

      // Check branding
      cy.contains('ElizaOS').should('be.visible');
    });

    it('should validate email field', () => {
      // Test empty email
      cy.get('button[type="submit"]').click();
      cy.get('input[type="email"]:invalid').should('exist');

      // Test invalid email format
      cy.get('input[type="email"]').type('invalid-email');
      cy.get('button[type="submit"]').click();
      cy.get('input[type="email"]:invalid').should('exist');

      // Test valid email
      cy.get('input[type="email"]').clear().type('test@example.com');
      cy.get('input[type="email"]:valid').should('exist');
    });

    it('should validate password field', () => {
      cy.get('input[type="email"]').type('test@example.com');

      // Empty password should prevent submission
      cy.get('button[type="submit"]').click();
      cy.get('input[type="password"]:invalid').should('exist');

      // Valid password
      cy.get('input[type="password"]').type('password123');
      cy.get('input[type="password"]:valid').should('exist');
    });

    it('should handle login form submission', () => {
      cy.get('input[type="email"]').type('test@example.com');
      cy.get('input[type="password"]').type('password123');

      // Mock the login API call
      cy.intercept('POST', '**/auth/login', {
        statusCode: 200,
        body: { token: 'mock-token', user: { email: 'test@example.com' } },
      }).as('loginRequest');

      cy.get('button[type="submit"]').click();

      // Should make API call
      cy.wait('@loginRequest');
    });

    it('should handle login errors', () => {
      cy.get('input[type="email"]').type('test@example.com');
      cy.get('input[type="password"]').type('wrongpassword');

      // Mock failed login
      cy.intercept('POST', '**/auth/login', {
        statusCode: 401,
        body: { error: 'Invalid credentials' },
      }).as('failedLogin');

      cy.get('button[type="submit"]').click();
      cy.wait('@failedLogin');

      // Should display error message
      cy.contains('Invalid credentials').should('be.visible');
    });

    it('should have working forgot password link', () => {
      cy.get('a').contains('Forgot').click();
      cy.url().should('include', '/auth/forgot-password');
    });

    it('should have working signup link', () => {
      cy.visit('/auth/login');
      cy.get('a').contains('Sign up').click();
      cy.url().should('include', '/auth/signup');
    });

    it('should handle dev login in development mode', () => {
      // Check if dev login button exists in development
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="dev-login"]').length > 0) {
          cy.get('[data-cy="dev-login"]').click();
          // Should redirect to dashboard
          cy.url().should('include', '/dashboard');
        }
      });
    });
  });

  describe('Signup Page', () => {
    beforeEach(() => {
      cy.visit('/auth/signup');
    });

    it('should display signup page correctly', () => {
      cy.url().should('include', '/auth/signup');

      // Check form fields
      cy.get('input[type="email"]').should('be.visible');
      cy.get('input[type="password"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');

      // Check terms and conditions
      cy.contains('Terms').should('be.visible');
      cy.contains('Privacy').should('be.visible');
    });

    it('should validate signup form', () => {
      // Test email validation
      cy.get('input[type="email"]').type('invalid-email');
      cy.get('button[type="submit"]').click();
      cy.get('input[type="email"]:invalid').should('exist');

      // Test password requirements
      cy.get('input[type="email"]').clear().type('test@example.com');
      cy.get('input[type="password"]').type('123'); // Too short
      cy.get('button[type="submit"]').click();

      // Should show password requirements
      cy.contains('password').should('be.visible');
    });

    it('should handle signup form submission', () => {
      cy.get('input[type="email"]').type('newuser@example.com');
      cy.get('input[type="password"]').type('SecurePassword123!');

      // Accept terms if checkbox exists
      cy.get('body').then(($body) => {
        if ($body.find('input[type="checkbox"]').length > 0) {
          cy.get('input[type="checkbox"]').check();
        }
      });

      // Mock signup API
      cy.intercept('POST', '**/auth/signup', {
        statusCode: 201,
        body: { message: 'Account created successfully' },
      }).as('signupRequest');

      cy.get('button[type="submit"]').click();
      cy.wait('@signupRequest');
    });

    it('should handle signup errors', () => {
      cy.get('input[type="email"]').type('existing@example.com');
      cy.get('input[type="password"]').type('SecurePassword123!');

      // Mock signup error
      cy.intercept('POST', '**/auth/signup', {
        statusCode: 409,
        body: { error: 'Email already exists' },
      }).as('signupError');

      cy.get('button[type="submit"]').click();
      cy.wait('@signupError');

      // Should display error
      cy.contains('already exists').should('be.visible');
    });

    it('should have working login link', () => {
      cy.get('a').contains('Sign in').click();
      cy.url().should('include', '/auth/login');
    });
  });

  describe('Forgot Password Page', () => {
    beforeEach(() => {
      cy.visit('/auth/forgot-password');
    });

    it('should display forgot password page correctly', () => {
      cy.url().should('include', '/auth/forgot-password');

      cy.get('input[type="email"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');
      cy.contains('Reset').should('be.visible');
    });

    it('should validate email field', () => {
      cy.get('button[type="submit"]').click();
      cy.get('input[type="email"]:invalid').should('exist');

      cy.get('input[type="email"]').type('invalid-email');
      cy.get('button[type="submit"]').click();
      cy.get('input[type="email"]:invalid').should('exist');
    });

    it('should handle password reset request', () => {
      cy.get('input[type="email"]').type('test@example.com');

      cy.intercept('POST', '**/auth/forgot-password', {
        statusCode: 200,
        body: { message: 'Reset email sent' },
      }).as('resetRequest');

      cy.get('button[type="submit"]').click();
      cy.wait('@resetRequest');

      cy.contains('Reset email sent').should('be.visible');
    });

    it('should have working back to login link', () => {
      cy.get('a').contains('Back to').click();
      cy.url().should('include', '/auth/login');
    });
  });

  describe('Authentication State Management', () => {
    it('should redirect authenticated users from auth pages', () => {
      // Mock authenticated state
      cy.window().then((win) => {
        win.localStorage.setItem('auth-token', 'mock-token');
      });

      cy.intercept('GET', '**/auth/identity', {
        statusCode: 200,
        body: { user: { email: 'test@example.com' } },
      }).as('authCheck');

      cy.visit('/auth/login');
      cy.wait('@authCheck');

      // Should redirect to dashboard
      cy.url().should('include', '/dashboard');
    });

    it('should handle session expiration', () => {
      // Set expired token
      cy.window().then((win) => {
        win.localStorage.setItem('auth-token', 'expired-token');
      });

      cy.intercept('GET', '**/auth/identity', {
        statusCode: 401,
        body: { error: 'Token expired' },
      }).as('expiredAuth');

      cy.visit('/dashboard');
      cy.wait('@expiredAuth');

      // Should redirect to login
      cy.url().should('include', '/auth/login');
    });

    it('should handle logout', () => {
      // Set authenticated state
      cy.window().then((win) => {
        win.localStorage.setItem('auth-token', 'mock-token');
      });

      cy.intercept('POST', '**/auth/logout', {
        statusCode: 200,
        body: { success: true },
      }).as('logoutRequest');

      cy.visit('/dashboard');

      // Find and click logout button
      cy.get('[data-cy="user-menu"]').click();
      cy.get('[data-cy="logout"]').click();

      cy.wait('@logoutRequest');

      // Should redirect to landing page
      cy.url().should('eq', Cypress.config().baseUrl + '/');
    });
  });

  describe('Social Authentication', () => {
    beforeEach(() => {
      cy.visit('/auth/login');
    });

    it('should display social login options if available', () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="google-login"]').length > 0) {
          cy.get('[data-cy="google-login"]').should('be.visible');
        }
        if ($body.find('[data-cy="github-login"]').length > 0) {
          cy.get('[data-cy="github-login"]').should('be.visible');
        }
      });
    });

    it('should handle social login redirects', () => {
      cy.get('body').then(($body) => {
        if ($body.find('[data-cy="google-login"]').length > 0) {
          // Mock the redirect (can't actually test OAuth flow in Cypress)
          cy.get('[data-cy="google-login"]').should('have.attr', 'href');
        }
      });
    });
  });

  describe('Accessibility and UX', () => {
    it('should support keyboard navigation on login page', () => {
      cy.visit('/auth/login');

      // Tab through form elements
      cy.get('input[type="email"]').focus().tab();
      cy.focused().should('have.attr', 'type', 'password');

      cy.tab();
      cy.focused()
        .should('contain', 'Sign in')
        .or('have.attr', 'type', 'submit');
    });

    it('should show loading states during form submission', () => {
      cy.visit('/auth/login');

      cy.get('input[type="email"]').type('test@example.com');
      cy.get('input[type="password"]').type('password123');

      // Mock slow API response
      cy.intercept('POST', '**/auth/login', (req) => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({ statusCode: 200, body: { token: 'mock-token' } });
          }, 1000);
        });
      }).as('slowLogin');

      cy.get('button[type="submit"]').click();

      // Button should show loading state
      cy.get('button[type="submit"]').should('be.disabled');
    });

    it('should have proper ARIA labels and roles', () => {
      cy.visit('/auth/login');

      // Form should have proper role
      cy.get('form').should('have.attr', 'role').or('exist');

      // Inputs should have proper labels
      cy.get('input[type="email"]')
        .should('have.attr', 'aria-label')
        .or('have.attr', 'placeholder');
      cy.get('input[type="password"]')
        .should('have.attr', 'aria-label')
        .or('have.attr', 'placeholder');
    });
  });

  describe('Mobile Responsive Design', () => {
    it('should work on mobile devices', () => {
      cy.viewport(375, 667); // iPhone SE

      cy.visit('/auth/login');

      // Form should be visible and usable
      cy.get('form').should('be.visible');
      cy.get('input[type="email"]').should('be.visible');
      cy.get('input[type="password"]').should('be.visible');
      cy.get('button[type="submit"]').should('be.visible');

      // Should be able to interact with form
      cy.get('input[type="email"]').type('test@example.com');
      cy.get('input[type="password"]').type('password123');
    });
  });
});
