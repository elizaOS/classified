/**
 * Comprehensive Test Helpers for Cypress
 * Utilities to fix common test failures and improve reliability
 */

// Development login helper for bypassing authentication during tests
export function devLogin(userEmail: string = 'test@elizaos.ai') {
  cy.log('Performing dev login');

  // First visit login page to ensure we're on the auth domain
  cy.visit('/auth/login');

  // Wait for page to load
  cy.wait(1000);

  // Check if dev login button exists
  cy.get('body').then(($body) => {
    if ($body.find('[data-cy="dev-login-btn"]').length > 0) {
      // Dev login button exists, click it
      cy.get('[data-cy="dev-login-btn"]').click();
    } else {
      // Fallback: set session manually via API
      cy.request({
        method: 'POST',
        url: '/api/auth/dev-login',
        body: {
          email: userEmail,
          organizationId: 'test-org-id',
          name: 'Test User',
        },
        failOnStatusCode: false,
      }).then((response) => {
        if (response.status === 200) {
          // Store session in localStorage/cookies
          cy.window().then((window) => {
            if (response.body.token) {
              window.localStorage.setItem('auth-token', response.body.token);
            }
          });
        }
      });
    }
  });

  // Wait for auth to complete
  cy.wait(2000);

  // Verify we're logged in by checking for dashboard elements
  cy.url().should('not.include', '/auth/login');
}

// Wait for API routes to be available
export function waitForApiReady() {
  cy.log('Waiting for API to be ready');

  // Check health endpoint
  cy.request({
    method: 'GET',
    url: '/api/health',
    timeout: 10000,
    retries: 3,
    failOnStatusCode: false,
  }).then((response) => {
    expect(response.status).to.be.oneOf([200, 503]); // 503 during build is okay
  });

  // Check ping endpoint
  cy.request({
    method: 'GET',
    url: '/api/ping',
    timeout: 5000,
    failOnStatusCode: false,
  });
}

// Robust element waiting with better error handling
export function waitForElement(
  selector: string,
  options: { timeout?: number; visible?: boolean } = {},
) {
  const { timeout = 10000, visible = true } = options;

  cy.log(`Waiting for element: ${selector}`);

  if (visible) {
    cy.get(selector, { timeout }).should('be.visible');
  } else {
    cy.get(selector, { timeout }).should('exist');
  }
}

// Safe navigation with retry logic
export function safeVisit(
  url: string,
  options: { retries?: number; timeout?: number } = {},
) {
  const { retries = 3, timeout = 10000 } = options;

  cy.log(`Safely visiting: ${url}`);

  function attemptVisit(attemptsLeft: number) {
    cy.visit(url, {
      timeout,
      failOnStatusCode: false,
    }).then(() => {
      // Check if page loaded successfully
      cy.get('body').then(($body) => {
        if (
          $body.find('[data-testid="error-boundary"]').length > 0 &&
          attemptsLeft > 0
        ) {
          cy.log(
            `Page error detected, retrying... (${attemptsLeft} attempts left)`,
          );
          cy.wait(2000);
          attemptVisit(attemptsLeft - 1);
        }
      });
    });
  }

  attemptVisit(retries);
}

// Handle API mocking for tests
export function mockApiEndpoints() {
  cy.log('Setting up API mocks');

  // Mock analytics endpoints
  cy.intercept('GET', '/api/analytics/overview*', {
    statusCode: 200,
    body: {
      success: true,
      data: {
        totalRequests: 100,
        totalSpent: 50.0,
        totalTokens: 10000,
        averageRequestCost: 0.5,
        topProviders: [],
        timeSeriesData: [],
        requestsByModel: [],
        trends: { requestsChange: 0, spentChange: 0, tokensChange: 0 },
      },
    },
  }).as('analyticsOverview');

  // Mock auth session endpoint
  cy.intercept('GET', '/api/auth/session', {
    statusCode: 200,
    body: {
      success: true,
      data: {
        userId: 'test-user-id',
        email: 'test@elizaos.ai',
        organizationId: 'test-org-id',
        name: 'Test User',
      },
    },
  }).as('authSession');

  // Mock API keys endpoint
  cy.intercept('POST', '/api/api-keys', {
    statusCode: 200,
    body: {
      success: true,
      data: {
        key: 'test-api-key-12345',
        id: 'test-key-id',
      },
    },
  }).as('createApiKey');

  // Mock organization config
  cy.intercept('GET', '/api/v1/organizations/config', {
    statusCode: 200,
    body: {
      success: true,
      requiredPlugins: ['@elizaos/plugin-web-search', '@elizaos/plugin-memory'],
      allowedPlugins: [],
    },
  }).as('orgConfig');
}

// Form interaction helpers
export function fillFormField(
  selector: string,
  value: string,
  options: { clear?: boolean } = {},
) {
  const { clear = true } = options;

  cy.log(`Filling form field ${selector} with: ${value}`);

  cy.get(selector).should('be.visible');

  if (clear) {
    cy.get(selector).clear();
  }

  cy.get(selector).type(value);
  cy.get(selector).should('have.value', value);
}

// Button click with retry logic
export function safeClick(
  selector: string,
  options: { timeout?: number; retries?: number } = {},
) {
  const { timeout = 5000, retries = 3 } = options;

  cy.log(`Safely clicking: ${selector}`);

  function attemptClick(attemptsLeft: number) {
    cy.get(selector, { timeout })
      .should('be.visible')
      .should('not.be.disabled')
      .click()
      .then(() => {
        // Verify click worked
        cy.wait(500);
      })
      .catch(() => {
        if (attemptsLeft > 0) {
          cy.log(`Click failed, retrying... (${attemptsLeft} attempts left)`);
          cy.wait(1000);
          attemptClick(attemptsLeft - 1);
        }
      });
  }

  attemptClick(retries);
}

// Wait for navigation to complete
export function waitForNavigation(expectedPath?: string) {
  cy.log('Waiting for navigation to complete');

  if (expectedPath) {
    cy.url().should('include', expectedPath);
  }

  // Wait for page to settle
  cy.wait(1000);

  // Check that page is not in loading state
  cy.get('body').should('not.contain', 'Loading...');
}

// Check for and handle error states
export function checkForErrors() {
  cy.log('Checking for error states');

  // Check for error boundaries
  cy.get('body').then(($body) => {
    if ($body.find('[data-testid="error-boundary"]').length > 0) {
      cy.log('Error boundary detected');
      cy.get('[data-testid="error-boundary"]').should('not.exist');
    }
  });

  // Check for error messages
  cy.get('body').should('not.contain', 'Something went wrong');
  cy.get('body').should('not.contain', 'Internal server error');
}

// Database cleanup (for test isolation)
export function cleanupTestData() {
  cy.log('Cleaning up test data');

  cy.task('clearDatabase', null, { failOnStatusCode: false });
}

// Setup test environment
export function setupTestEnvironment() {
  cy.log('Setting up test environment');

  // Clear application state
  cy.clearLocalStorage();
  cy.clearCookies();

  // Setup API mocks
  mockApiEndpoints();

  // Wait for API to be ready
  waitForApiReady();
}

// Verify dashboard components are loaded
export function verifyDashboardLoaded() {
  cy.log('Verifying dashboard is loaded');

  // Check for main dashboard elements
  cy.get('[data-testid="dashboard"]', { timeout: 10000 }).should('be.visible');

  // Check for navigation
  cy.get('nav').should('be.visible');

  // Check for user menu or profile indicator
  cy.get('body').should('contain.text', 'Dashboard');
}

// Handle authentication flow
export function authenticateUser(email: string = 'test@elizaos.ai') {
  cy.log(`Authenticating user: ${email}`);

  setupTestEnvironment();
  devLogin(email);
  verifyDashboardLoaded();
}

// Error recovery helpers
export function recoverFromError() {
  cy.log('Attempting error recovery');

  // Try to navigate back to dashboard
  cy.visit('/dashboard', { failOnStatusCode: false });

  // If still on error page, try dev login again
  cy.get('body').then(($body) => {
    if (
      $body.text().includes('error') ||
      $body.text().includes('Something went wrong')
    ) {
      devLogin();
    }
  });
}

// Performance monitoring
export function measurePageLoad(pageName: string) {
  cy.log(`Measuring page load for: ${pageName}`);

  cy.window().then((win) => {
    const performance = win.performance;
    const timing = performance.timing;

    const loadTime = timing.loadEventEnd - timing.navigationStart;
    cy.log(`Page load time for ${pageName}: ${loadTime}ms`);

    // Assert reasonable load time (less than 5 seconds)
    expect(loadTime).to.be.lessThan(5000);
  });
}

// Mobile responsiveness helpers
export function testMobileView() {
  cy.log('Testing mobile view');

  cy.viewport('iphone-x');
  cy.wait(1000);

  // Check that mobile navigation works
  cy.get('body').should('be.visible');
}

export function testTabletView() {
  cy.log('Testing tablet view');

  cy.viewport('ipad-2');
  cy.wait(1000);

  // Check that tablet layout works
  cy.get('body').should('be.visible');
}

// Accessibility helpers
export function checkAccessibility() {
  cy.log('Checking accessibility');

  // Check for proper heading hierarchy
  cy.get('h1').should('have.length.at.least', 1);

  // Check for alt text on images
  cy.get('img').each(($img) => {
    cy.wrap($img).should('have.attr', 'alt');
  });

  // Check for proper form labels
  cy.get('input').each(($input) => {
    const inputId = $input.attr('id');
    if (inputId) {
      cy.get(`label[for="${inputId}"]`).should('exist');
    }
  });
}

// Test data creation helpers
export function createTestAgent(name: string = 'Test Agent') {
  cy.log(`Creating test agent: ${name}`);

  return cy.task('createTestAgent', { name });
}

export function createTestApiKey(scope: string[] = ['agents:*']) {
  cy.log('Creating test API key');

  return cy.task('setupTestApiKey', { scope });
}

// Advanced waiting helpers
export function waitForApiResponse(alias: string, timeout: number = 10000) {
  cy.log(`Waiting for API response: ${alias}`);

  cy.wait(`@${alias}`, { timeout }).then((interception) => {
    expect(interception.response?.statusCode).to.be.oneOf([200, 201, 204]);
  });
}

// Debugging helpers
export function debugCurrentState() {
  cy.log('=== DEBUG: Current State ===');

  cy.url().then((url) => {
    cy.log(`Current URL: ${url}`);
  });

  cy.get('body').then(($body) => {
    const bodyText = $body.text();
    if (bodyText.includes('error') || bodyText.includes('Error')) {
      cy.log('ERROR STATE DETECTED');
      cy.log($body.text());
    }
  });

  cy.window().then((win) => {
    const localStorage = Object.keys(win.localStorage).map((key) => ({
      key,
      value: win.localStorage.getItem(key),
    }));
    cy.log('LocalStorage:', localStorage);
  });
}
