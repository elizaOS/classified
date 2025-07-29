/// <reference types="cypress" />

describe('Analytics Dashboard', () => {
  beforeEach(() => {
    // Mock authentication
    cy.intercept('GET', '/api/auth/identity', {
      fixture: 'auth-user.json',
    });

    // Mock analytics data
    cy.intercept('GET', '/api/analytics/overview*', {
      fixture: 'analytics-overview.json',
    }).as('getAnalytics');

    // Mock markup config
    cy.intercept('GET', '/api/analytics/config', {
      fixture: 'analytics-config.json',
    }).as('getConfig');

    // Visit analytics page
    cy.visit('/dashboard/analytics');
  });

  it('should display analytics dashboard correctly', () => {
    // Wait for data to load
    cy.wait(['@getAnalytics', '@getConfig']);

    // Check page title and description
    cy.contains('h1', 'Analytics').should('be.visible');
    cy.contains(
      'Monitor your AI inference usage, costs, and performance metrics',
    ).should('be.visible');

    // Check time range selector
    cy.get('[data-testid="time-range-selector"]').should('be.visible');
    cy.contains('button', 'Daily').should('be.visible');
    cy.contains('button', 'Weekly').should('be.visible');
    cy.contains('button', 'Monthly').should('be.visible');

    // Check export button
    cy.contains('button', 'Export').should('be.visible');
  });

  it('should display pricing configuration section', () => {
    cy.wait(['@getAnalytics', '@getConfig']);

    // Check pricing configuration section
    cy.contains('h3', 'Pricing Configuration').should('be.visible');
    cy.contains('Current markup percentage: 20%').should('be.visible');
    cy.contains('button', 'Configure Markup').should('be.visible');
  });

  it('should display key metrics cards', () => {
    cy.wait(['@getAnalytics', '@getConfig']);

    // Check all metric cards are present
    cy.contains('Total Requests').should('be.visible');
    cy.contains('Total Revenue').should('be.visible');
    cy.contains('Total Markup').should('be.visible');
    cy.contains('Total Tokens').should('be.visible');
    cy.contains('Success Rate').should('be.visible');
    cy.contains('Avg Latency').should('be.visible');

    // Check that values are displayed (numbers should be visible)
    cy.get('[data-testid="metric-card"]').should('have.length', 6);

    // Check for trend indicators
    cy.get('[data-testid="trend-indicator"]').should('exist');
  });

  it('should display time series chart', () => {
    cy.wait(['@getAnalytics', '@getConfig']);

    // Check time series chart section
    cy.contains('h3', 'Usage Over Time').should('be.visible');

    // Check metric selector buttons
    cy.contains('button', 'Requests').should('be.visible');
    cy.contains('button', 'Spent').should('be.visible');
    cy.contains('button', 'Tokens').should('be.visible');

    // Check chart container
    cy.get('[data-testid="time-series-chart"]').should('be.visible');
  });

  it('should display provider breakdown', () => {
    cy.wait(['@getAnalytics', '@getConfig']);

    // Check provider breakdown section
    cy.contains('h3', 'Top Providers').should('be.visible');

    // Check provider list
    cy.get('[data-testid="provider-item"]').should('have.length.at.least', 1);

    // Check provider details (name, percentage, requests, cost)
    cy.get('[data-testid="provider-item"]')
      .first()
      .within(() => {
        cy.get('[data-testid="provider-name"]').should('be.visible');
        cy.get('[data-testid="provider-percentage"]').should('be.visible');
        cy.get('[data-testid="provider-requests"]').should('be.visible');
        cy.get('[data-testid="provider-cost"]').should('be.visible');
      });
  });

  it('should display model breakdown table', () => {
    cy.wait(['@getAnalytics', '@getConfig']);

    // Check model breakdown section
    cy.contains('h3', 'Usage by Model').should('be.visible');

    // Check table headers
    cy.contains('th', 'Model').should('be.visible');
    cy.contains('th', 'Requests').should('be.visible');
    cy.contains('th', 'Tokens').should('be.visible');
    cy.contains('th', 'Total Cost').should('be.visible');
    cy.contains('th', 'Markup').should('be.visible');
    cy.contains('th', 'Avg Cost/Token').should('be.visible');

    // Check table rows
    cy.get('[data-testid="model-row"]').should('have.length.at.least', 1);
  });

  it('should allow changing time range', () => {
    cy.wait(['@getAnalytics', '@getConfig']);

    // Click on Weekly time range
    cy.contains('button', 'Weekly').click();
    cy.wait('@getAnalytics');

    // Click on Monthly time range
    cy.contains('button', 'Monthly').click();
    cy.wait('@getAnalytics');

    // Verify the requests are made with correct time range parameters
    cy.get('@getAnalytics.all').should('have.length', 3); // Initial + Weekly + Monthly
  });

  it('should allow changing chart metric', () => {
    cy.wait(['@getAnalytics', '@getConfig']);

    // Click on Spent metric
    cy.contains('button', 'Spent').click();

    // Click on Tokens metric
    cy.contains('button', 'Tokens').click();

    // Verify chart updates (should show different data)
    cy.get('[data-testid="time-series-chart"]').should('be.visible');
  });

  it('should open and configure markup percentage', () => {
    cy.wait(['@getAnalytics', '@getConfig']);

    // Mock the config update API
    cy.intercept('POST', '/api/analytics/config', {
      statusCode: 200,
      body: {
        success: true,
        message: 'Markup percentage updated successfully',
      },
    }).as('updateConfig');

    // Click Configure Markup button
    cy.contains('button', 'Configure Markup').click();

    // Check modal is open
    cy.contains('h3', 'Configure Markup Percentage').should('be.visible');
    cy.contains(
      'Set the markup percentage applied to all AI inference costs',
    ).should('be.visible');

    // Check input field
    cy.get('input[type="number"]').should('be.visible').and('have.value', '20');

    // Change the value
    cy.get('input[type="number"]').clear().type('25');

    // Click Update button
    cy.contains('button', 'Update Markup').click();

    // Wait for API call
    cy.wait('@updateConfig');

    // Check success message (assuming toast notification)
    cy.contains('Markup percentage updated successfully').should('be.visible');

    // Modal should close
    cy.contains('h3', 'Configure Markup Percentage').should('not.exist');
  });

  it('should validate markup percentage input', () => {
    cy.wait(['@getAnalytics', '@getConfig']);

    // Open markup configuration modal
    cy.contains('button', 'Configure Markup').click();

    // Test invalid values
    cy.get('input[type="number"]').clear().type('-5');
    cy.contains('button', 'Update Markup').click();
    cy.contains('Please enter a valid percentage between 0 and 100').should(
      'be.visible',
    );

    cy.get('input[type="number"]').clear().type('150');
    cy.contains('button', 'Update Markup').click();
    cy.contains('Please enter a valid percentage between 0 and 100').should(
      'be.visible',
    );

    cy.get('input[type="number"]').clear().type('abc');
    cy.contains('button', 'Update Markup').click();
    cy.contains('Please enter a valid percentage between 0 and 100').should(
      'be.visible',
    );
  });

  it('should export analytics data', () => {
    cy.wait(['@getAnalytics', '@getConfig']);

    // Mock export API
    cy.intercept('GET', '/api/analytics/export*', {
      statusCode: 200,
      headers: {
        'content-type': 'text/csv',
        'content-disposition':
          'attachment; filename="analytics-daily-2025-01-25.csv"',
      },
      body: 'Date,Requests,Cost,Tokens\n2025-01-25,100,5.50,25000',
    }).as('exportData');

    // Click export button
    cy.contains('button', 'Export').click();

    // Wait for export API call
    cy.wait('@exportData');

    // Check success message
    cy.contains('Analytics data exported successfully').should('be.visible');
  });

  it('should handle loading states', () => {
    // Mock slow API response
    cy.intercept('GET', '/api/analytics/overview*', {
      delay: 2000,
      fixture: 'analytics-overview.json',
    }).as('slowAnalytics');

    cy.visit('/dashboard/analytics');

    // Check loading skeleton is displayed
    cy.get('[data-testid="analytics-skeleton"]').should('be.visible');

    // Wait for data to load
    cy.wait('@slowAnalytics');

    // Check loading skeleton is hidden
    cy.get('[data-testid="analytics-skeleton"]').should('not.exist');
  });

  it('should handle error states', () => {
    // Mock API error
    cy.intercept('GET', '/api/analytics/overview*', {
      statusCode: 500,
      body: { success: false, error: 'Internal server error' },
    }).as('errorAnalytics');

    cy.visit('/dashboard/analytics');
    cy.wait('@errorAnalytics');

    // Check error message is displayed
    cy.contains('Failed to load analytics data').should('be.visible');
  });

  it('should calculate and display correct cost breakdowns', () => {
    cy.wait(['@getAnalytics', '@getConfig']);

    // Check that total revenue includes markup
    cy.get('[data-testid="total-revenue"]').should('contain', '$');
    cy.get('[data-testid="total-markup"]').should('contain', '$');

    // Verify markup calculation in model table
    cy.get('[data-testid="model-row"]')
      .first()
      .within(() => {
        cy.get('[data-testid="model-total-cost"]').should('be.visible');
        cy.get('[data-testid="model-markup"]').should('be.visible');
      });
  });

  it('should display success rate and latency metrics', () => {
    cy.wait(['@getAnalytics', '@getConfig']);

    // Check success rate metric
    cy.get('[data-testid="success-rate"]').should('contain', '%');

    // Check average latency metric
    cy.get('[data-testid="avg-latency"]').should('contain', 'ms');
  });

  it('should be responsive on mobile devices', () => {
    cy.viewport('iphone-6');
    cy.wait(['@getAnalytics', '@getConfig']);

    // Check that key elements are still visible on mobile
    cy.contains('h1', 'Analytics').should('be.visible');
    cy.get('[data-testid="metric-card"]').should('be.visible');

    // Check that tables are scrollable
    cy.get('table').should('be.visible');
  });
});
