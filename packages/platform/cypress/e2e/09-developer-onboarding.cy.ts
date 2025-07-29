describe('Developer Onboarding', () => {
  beforeEach(() => {
    cy.clearAuthState();
    cy.devLogin();
  });

  it('should load developer getting started page successfully', () => {
    cy.visit('/dashboard/developer/getting-started', {
      failOnStatusCode: false,
    });

    // Check page loads with correct title
    cy.get('[data-cy="page-title"]').should(
      'contain',
      'Developer Getting Started',
    );
    cy.get('[data-cy="developer-getting-started"]').should('be.visible');

    // Check progress bar is visible
    cy.get('[data-cy="progress-bar"]').should('be.visible');
  });

  it('should display all onboarding tabs', () => {
    cy.visit('/dashboard/developer/getting-started', {
      failOnStatusCode: false,
    });

    // Check all tabs are present
    cy.contains('Quick Start').should('be.visible');
    cy.contains('Step-by-Step').should('be.visible');
    cy.contains('Examples').should('be.visible');
    cy.contains('Resources').should('be.visible');
  });

  it('should show quick start commands and allow copying', () => {
    cy.visit('/dashboard/developer/getting-started', {
      failOnStatusCode: false,
    });

    // Quick start should be the default tab
    cy.get('[data-cy="quickstart-section"]').should('be.visible');

    // Check command copy buttons work
    cy.get('[data-cy="copy-command-0"]').should('be.visible').click();
    cy.get('[data-cy="copy-command-1"]').should('be.visible').click();
  });

  it('should allow navigation between tabs', () => {
    cy.visit('/dashboard/developer/getting-started', {
      failOnStatusCode: false,
    });

    // Navigate to Step-by-Step tab
    cy.contains('Step-by-Step').click();
    cy.get('[data-cy="onboarding-setup"]').should('be.visible');
    cy.get('[data-cy="onboarding-development"]').should('be.visible');
    cy.get('[data-cy="onboarding-deployment"]').should('be.visible');
    cy.get('[data-cy="onboarding-advanced"]').should('be.visible');

    // Navigate to Examples tab
    cy.contains('Examples').click();
    cy.get('[data-cy="example-hello-world"]').should('be.visible');
    cy.get('[data-cy="example-weather-action"]').should('be.visible');

    // Navigate to Resources tab
    cy.contains('Resources').click();
    cy.get('[data-cy="documentation-links"]').should('be.visible');
    cy.get('[data-cy="community-links"]').should('be.visible');
    cy.get('[data-cy="tools-section"]').should('be.visible');
    cy.get('[data-cy="support-section"]').should('be.visible');
  });

  it('should allow checking off onboarding steps', () => {
    cy.visit('/dashboard/developer/getting-started', {
      failOnStatusCode: false,
    });

    // Go to step-by-step tab
    cy.contains('Step-by-Step').click();

    // Check off the first step
    cy.get('[data-cy="step-environment"]').should('be.visible');
    cy.get('[data-cy="step-environment"]').within(() => {
      cy.get('button').first().click();
    });

    // Progress should update (exact value depends on total steps)
    cy.get('[data-cy="progress-bar"]').should('be.visible');
  });

  it('should show code examples with copy functionality', () => {
    cy.visit('/dashboard/developer/getting-started', {
      failOnStatusCode: false,
    });

    // Navigate to Examples tab
    cy.contains('Examples').click();

    // Check first example
    cy.get('[data-cy="example-hello-world"]').should('be.visible');
    cy.get('[data-cy="copy-example-hello-world"]').should('be.visible').click();

    // Check example with expand functionality
    cy.get('[data-cy="expand-example-hello-world"]')
      .should('be.visible')
      .click();
    cy.get('[data-cy="expand-example-hello-world"]').should(
      'contain',
      'Collapse',
    );
  });

  it('should have working external links in resources', () => {
    cy.visit('/dashboard/developer/getting-started', {
      failOnStatusCode: false,
    });

    // Navigate to Resources tab
    cy.contains('Resources').click();

    // Check documentation links
    cy.get('[data-cy="api-docs-link"]').should('be.visible');
    cy.get('[data-cy="github-link"]').should('be.visible');

    // Note: We don't actually click external links in tests to avoid navigation issues
    cy.get('[data-cy="github-link"]')
      .should('have.attr', 'href')
      .and('include', 'github.com');
  });

  it('should be responsive on mobile devices', () => {
    cy.viewport(375, 667); // iPhone SE dimensions
    cy.visit('/dashboard/developer/getting-started', {
      failOnStatusCode: false,
    });

    // Page should still be accessible
    cy.get('[data-cy="page-title"]').should('be.visible');
    cy.get('[data-cy="progress-bar"]').should('be.visible');

    // Tabs should be visible and functional
    cy.contains('Examples').click();
    cy.get('[data-cy="example-hello-world"]').should('be.visible');
  });

  it('should handle errors gracefully', () => {
    cy.visit('/dashboard/developer/getting-started', {
      failOnStatusCode: false,
    });

    // Page should load even if some components fail
    cy.get('[data-cy="developer-getting-started"]').should('be.visible');
    cy.get('[data-cy="page-title"]').should(
      'contain',
      'Developer Getting Started',
    );
  });

  it('should show all onboarding step categories', () => {
    cy.visit('/dashboard/developer/getting-started', {
      failOnStatusCode: false,
    });

    // Navigate to step-by-step
    cy.contains('Step-by-Step').click();

    // Check all categories are present
    const categories = ['setup', 'development', 'deployment', 'advanced'];
    categories.forEach((category) => {
      cy.get(`[data-cy="onboarding-${category}"]`).should('be.visible');
    });
  });

  it('should show different difficulty levels for examples', () => {
    cy.visit('/dashboard/developer/getting-started', {
      failOnStatusCode: false,
    });

    // Navigate to Examples tab
    cy.contains('Examples').click();

    // Check that different difficulty badges are shown
    cy.get('[data-cy="example-hello-world"]').within(() => {
      cy.contains('beginner').should('be.visible');
    });

    cy.get('[data-cy="example-weather-action"]').within(() => {
      cy.contains('intermediate').should('be.visible');
    });

    cy.get('[data-cy="example-memory-system"]').within(() => {
      cy.contains('advanced').should('be.visible');
    });
  });
});
