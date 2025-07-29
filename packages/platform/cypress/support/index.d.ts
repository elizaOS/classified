/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    /**
     * Login as test user with valid session
     */
    loginAsTestUser(): Chainable<void>;

    /**
     * Login with specific user object
     */
    loginAs(user: any): Chainable<void>;

    /**
     * Mock authentication state
     */
    mockAuth(): Chainable<void>;

    /**
     * Visit page as authenticated user
     */
    visitAuthenticated(url: string): Chainable<void>;

    /**
     * Clear all authentication state
     */
    clearAuthState(): Chainable<void>;

    /**
     * Wait for page to be fully loaded
     */
    waitForPageLoad(): Chainable<void>;

    /**
     * Mock API success response
     */
    mockApiSuccess(
      method: string,
      endpoint: string,
      response: any,
    ): Chainable<void>;

    /**
     * Mock API error response
     */
    mockApiError(
      method: string,
      endpoint: string,
      error: string,
      statusCode?: number,
    ): Chainable<void>;

    /**
     * Fill login form
     */
    fillLoginForm(email: string, password: string): Chainable<void>;

    /**
     * Fill signup form
     */
    fillSignupForm(user: any): Chainable<void>;

    /**
     * Enable test mode
     */
    enableTestMode(): Chainable<void>;

    /**
     * Clean up test data
     */
    cleanupTestData(): Chainable<void>;
  }
}
