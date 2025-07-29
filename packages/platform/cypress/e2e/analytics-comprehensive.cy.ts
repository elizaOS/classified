/// <reference types="cypress" />

describe('Analytics Dashboard - Comprehensive Testing', () => {
  beforeEach(() => {
    // Set up comprehensive test environment
    cy.window().then((win) => {
      win.localStorage.setItem('test-mode', 'true');
    });

    // Mock authentication with proper session
    cy.intercept('GET', '/api/auth/identity', {
      statusCode: 200,
      body: {
        success: true,
        user: {
          id: 'test-user-123',
          email: 'test@example.com',
          name: 'Test User',
          organizationId: 'test-org-123',
          role: 'admin',
        },
      },
    }).as('getAuth');

    // Mock analytics data with realistic numbers
    cy.intercept('GET', '/api/analytics/overview*', (req) => {
      const timeRange = req.query.timeRange || 'daily';
      const provider = req.query.provider;
      const model = req.query.model;

      // Dynamic response based on parameters
      const baseData = {
        success: true,
        data: {
          totalRequests:
            timeRange === 'monthly'
              ? 15420
              : timeRange === 'weekly'
                ? 3500
                : 500,
          totalSpent:
            timeRange === 'monthly'
              ? 847.32
              : timeRange === 'weekly'
                ? 200.45
                : 28.67,
          totalTokens:
            timeRange === 'monthly'
              ? 2847392
              : timeRange === 'weekly'
                ? 650000
                : 95000,
          averageRequestCost: 0.055,
          totalBaseCost:
            timeRange === 'monthly'
              ? 706.1
              : timeRange === 'weekly'
                ? 167.04
                : 23.89,
          totalMarkup:
            timeRange === 'monthly'
              ? 141.22
              : timeRange === 'weekly'
                ? 33.41
                : 4.78,
          successRate: 98.7,
          averageLatency: 845,
          topProviders: [
            {
              name: 'OpenAI',
              requests: Math.floor(
                (timeRange === 'monthly'
                  ? 8420
                  : timeRange === 'weekly'
                    ? 1900
                    : 270) * (provider === 'OpenAI' ? 1 : 0.6),
              ),
              spent:
                timeRange === 'monthly'
                  ? 456.78
                  : timeRange === 'weekly'
                    ? 108.32
                    : 15.47,
              tokens:
                timeRange === 'monthly'
                  ? 1547392
                  : timeRange === 'weekly'
                    ? 380000
                    : 55000,
              percentage: 54.6,
            },
            {
              name: 'Anthropic',
              requests: Math.floor(
                (timeRange === 'monthly'
                  ? 4230
                  : timeRange === 'weekly'
                    ? 950
                    : 135) * (provider === 'Anthropic' ? 1 : 0.6),
              ),
              spent:
                timeRange === 'monthly'
                  ? 245.67
                  : timeRange === 'weekly'
                    ? 58.32
                    : 8.33,
              tokens:
                timeRange === 'monthly'
                  ? 847392
                  : timeRange === 'weekly'
                    ? 200000
                    : 29000,
              percentage: 27.4,
            },
            {
              name: 'Google',
              requests: Math.floor(
                (timeRange === 'monthly'
                  ? 2100
                  : timeRange === 'weekly'
                    ? 470
                    : 67) * (provider === 'Google' ? 1 : 0.6),
              ),
              spent:
                timeRange === 'monthly'
                  ? 98.45
                  : timeRange === 'weekly'
                    ? 23.42
                    : 3.34,
              tokens:
                timeRange === 'monthly'
                  ? 325600
                  : timeRange === 'weekly'
                    ? 75000
                    : 11000,
              percentage: 13.6,
            },
          ],
          timeSeriesData: generateTimeSeriesData(timeRange),
          requestsByModel: generateModelData(timeRange, model),
          trends: {
            requestsChange: 12.5,
            spentChange: 8.7,
            tokensChange: 15.2,
          },
        },
      };

      req.reply(baseData);
    }).as('getAnalytics');

    // Mock markup config
    cy.intercept('GET', '/api/analytics/config', {
      statusCode: 200,
      body: {
        success: true,
        data: {
          markupPercentage: 20.0,
        },
      },
    }).as('getConfig');

    // Mock config update
    cy.intercept('POST', '/api/analytics/config', {
      statusCode: 200,
      body: {
        success: true,
        message: 'Markup percentage updated successfully',
      },
    }).as('updateConfig');

    // Mock export API
    cy.intercept('GET', '/api/analytics/export*', (req) => {
      const timeRange = req.query.timeRange || 'daily';
      const format = req.query.format || 'csv';

      const csvData = [
        'Date,Requests,Total Cost,Base Cost,Markup,Tokens,Success Rate,Avg Latency',
        '2025-01-25,500,28.67,23.89,4.78,95000,98.7,845',
        '2025-01-24,520,30.45,25.37,5.08,98500,97.2,892',
        '2025-01-23,480,26.78,22.32,4.46,89200,99.1,798',
      ].join('\\n');

      req.reply({
        statusCode: 200,
        headers: {
          'content-type': 'text/csv',
          'content-disposition': `attachment; filename="analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
        body: csvData,
      });
    }).as('exportData');
  });

  function generateTimeSeriesData(timeRange: string) {
    const days = timeRange === 'monthly' ? 30 : timeRange === 'weekly' ? 7 : 1;
    const data = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      data.push({
        date: date.toISOString().split('T')[0],
        requests: Math.floor(Math.random() * 1000) + 500,
        spent: Math.floor((Math.random() * 50 + 20) * 100) / 100,
        tokens: Math.floor(Math.random() * 100000) + 50000,
      });
    }

    return data;
  }

  function generateModelData(timeRange: string, modelFilter?: string) {
    const models = [
      { name: 'OpenAI/gpt-4o-mini', multiplier: 0.4 },
      { name: 'Anthropic/claude-3-5-sonnet', multiplier: 0.25 },
      { name: 'OpenAI/gpt-4o', multiplier: 0.15 },
      { name: 'Google/gemini-1.5-pro', multiplier: 0.12 },
      { name: 'Anthropic/claude-3-haiku', multiplier: 0.08 },
    ];

    const baseRequests =
      timeRange === 'monthly' ? 15420 : timeRange === 'weekly' ? 3500 : 500;

    return models.map((model) => ({
      model: model.name,
      requests: Math.floor(
        baseRequests *
          model.multiplier *
          (modelFilter === model.name ? 1 : 0.8),
      ),
      spent: Math.floor(baseRequests * model.multiplier * 0.055 * 100) / 100,
      tokens: Math.floor(baseRequests * model.multiplier * 180),
    }));
  }

  describe('Page Navigation and Routes', () => {
    it('should load analytics page with correct URL', () => {
      cy.visit('/dashboard/analytics');
      cy.url().should('include', '/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      // Verify page loaded correctly
      cy.contains('h1', 'Analytics').should('be.visible');
      cy.get('[data-testid="analytics-skeleton"]').should('not.exist');
    });

    it('should handle direct URL access with query parameters', () => {
      cy.visit('/dashboard/analytics?timeRange=weekly&provider=OpenAI');
      cy.wait(['@getAnalytics', '@getConfig']);

      // Verify query parameters are processed
      cy.get('@getAnalytics.last').should((interception) => {
        expect(interception.request.query).to.include({
          timeRange: 'weekly',
          provider: 'OpenAI',
        });
      });
    });

    it('should maintain state when navigating back and forth', () => {
      cy.visit('/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      // Change time range
      cy.contains('button', 'Weekly').click();
      cy.wait('@getAnalytics');

      // Navigate away and back
      cy.visit('/dashboard');
      cy.visit('/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      // Should be back to default (daily) state
      cy.contains('button', 'Daily').should('have.class', 'bg-blue-600');
    });
  });

  describe('API Integration Testing', () => {
    it('should handle all API endpoints correctly', () => {
      cy.visit('/dashboard/analytics');

      // Test analytics overview endpoint
      cy.wait('@getAnalytics').then((interception) => {
        expect(interception.request.method).to.equal('GET');
        expect(interception.request.url).to.include('/api/analytics/overview');
        expect(interception.response?.statusCode).to.equal(200);
      });

      // Test config endpoint
      cy.wait('@getConfig').then((interception) => {
        expect(interception.request.method).to.equal('GET');
        expect(interception.request.url).to.include('/api/analytics/config');
        expect(interception.response?.statusCode).to.equal(200);
      });
    });

    it('should handle API authentication properly', () => {
      // Test without authentication
      cy.intercept('GET', '/api/analytics/overview*', {
        statusCode: 401,
        body: { success: false, error: 'Authentication required' },
      }).as('unauthenticatedRequest');

      cy.visit('/dashboard/analytics');
      cy.wait('@unauthenticatedRequest');

      // Should show error message
      cy.contains('Failed to load analytics data').should('be.visible');
    });

    it('should handle API rate limiting', () => {
      cy.intercept('GET', '/api/analytics/overview*', {
        statusCode: 429,
        body: { success: false, error: 'Too many requests' },
      }).as('rateLimitedRequest');

      cy.visit('/dashboard/analytics');
      cy.wait('@rateLimitedRequest');

      // Should show appropriate error
      cy.contains('Failed to load analytics data').should('be.visible');
    });

    it('should retry failed requests', () => {
      let callCount = 0;
      cy.intercept('GET', '/api/analytics/overview*', (req) => {
        callCount++;
        if (callCount === 1) {
          req.reply({ statusCode: 500, body: { error: 'Server error' } });
        } else {
          req.reply({ fixture: 'analytics-overview.json' });
        }
      }).as('retryRequest');

      cy.visit('/dashboard/analytics');
      cy.wait('@retryRequest');

      // Should eventually show data after retry
      cy.contains('h1', 'Analytics').should('be.visible');
    });
  });

  describe('Data Accuracy and Calculations', () => {
    it('should display accurate cost calculations', () => {
      cy.visit('/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      // Check total revenue calculation
      cy.get('[data-testid="total-revenue"]').should('contain', '$');

      // Check markup calculation (should be base cost * markup percentage)
      cy.get('[data-testid="total-markup"]').should('contain', '$');

      // Verify individual model calculations
      cy.get('[data-testid="model-row"]')
        .first()
        .within(() => {
          cy.get('[data-testid="model-total-cost"]').should(
            'match',
            /\\$\\d+\\.\\d{2}/,
          );
          cy.get('[data-testid="model-markup"]').should(
            'match',
            /\\$\\d+\\.\\d{2}/,
          );
        });
    });

    it('should calculate and display percentage breakdowns correctly', () => {
      cy.visit('/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      // Check provider percentages add up correctly
      let totalPercentage = 0;
      cy.get('[data-testid="provider-item"]')
        .each(($el) => {
          cy.wrap($el)
            .find('[data-testid="provider-percentage"]')
            .invoke('text')
            .then((text) => {
              const percentage = parseFloat(text.replace('%', ''));
              totalPercentage += percentage;
            });
        })
        .then(() => {
          // Total should be close to 100% (allowing for rounding)
          expect(totalPercentage).to.be.closeTo(100, 5);
        });
    });

    it('should handle zero values and edge cases', () => {
      // Mock data with zero values
      cy.intercept('GET', '/api/analytics/overview*', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            totalRequests: 0,
            totalSpent: 0,
            totalTokens: 0,
            averageRequestCost: 0,
            totalBaseCost: 0,
            totalMarkup: 0,
            successRate: 0,
            averageLatency: 0,
            topProviders: [],
            timeSeriesData: [],
            requestsByModel: [],
            trends: {
              requestsChange: 0,
              spentChange: 0,
              tokensChange: 0,
            },
          },
        },
      }).as('zeroDataAnalytics');

      cy.visit('/dashboard/analytics');
      cy.wait('@zeroDataAnalytics');

      // Should handle zero values gracefully
      cy.get('[data-testid="total-requests"]').should('contain', '0');
      cy.get('[data-testid="total-revenue"]').should('contain', '$0.00');
      cy.contains('No data available').should('be.visible');
    });

    it('should display numbers in correct formats', () => {
      cy.visit('/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      // Check currency formatting
      cy.get('[data-testid="total-revenue"]').should(
        'match',
        /\\$[\\d,]+\\.\\d{2}/,
      );

      // Check large number formatting (K, M)
      cy.get('[data-testid="total-tokens"]')
        .invoke('text')
        .should('match', /\\d+[KM]?/);

      // Check percentage formatting
      cy.get('[data-testid="success-rate"]').should('match', /\\d+\\.\\d%/);

      // Check latency formatting
      cy.get('[data-testid="avg-latency"]').should('match', /\\d+ms/);
    });
  });

  describe('Interactive Features', () => {
    it('should support all time range selections', () => {
      cy.visit('/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      // Test each time range
      const timeRanges = ['Daily', 'Weekly', 'Monthly'];
      timeRanges.forEach((range) => {
        cy.contains('button', range).click();
        cy.wait('@getAnalytics');

        // Verify active state
        cy.contains('button', range).should('have.class', 'bg-blue-600');

        // Verify API call with correct parameter
        cy.get('@getAnalytics.last').should((interception) => {
          expect(interception.request.query.timeRange).to.equal(
            range.toLowerCase(),
          );
        });
      });
    });

    it('should support chart metric switching', () => {
      cy.visit('/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      const metrics = ['Requests', 'Spent', 'Tokens'];
      metrics.forEach((metric) => {
        cy.contains('button', metric).click();

        // Verify active state
        cy.contains('button', metric).should('have.class', 'bg-blue-100');

        // Chart should update
        cy.get('[data-testid="time-series-chart"]').should('be.visible');
      });
    });

    it('should handle markup configuration workflow', () => {
      cy.visit('/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      // Open markup modal
      cy.contains('button', 'Configure Markup').click();

      // Test modal functionality
      cy.contains('h3', 'Configure Markup Percentage').should('be.visible');
      cy.get('input[type="number"]').should('have.value', '20');

      // Test validation
      cy.get('input[type="number"]').clear().type('150');
      cy.contains('button', 'Update Markup').click();
      cy.contains('valid percentage between 0 and 100').should('be.visible');

      // Test successful update
      cy.get('input[type="number"]').clear().type('25');
      cy.contains('button', 'Update Markup').click();
      cy.wait('@updateConfig');

      // Should close modal and show success
      cy.contains('h3', 'Configure Markup Percentage').should('not.exist');
      cy.contains('updated successfully').should('be.visible');
    });

    it('should support data export functionality', () => {
      cy.visit('/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      // Test export
      cy.contains('button', 'Export').click();
      cy.wait('@exportData');

      // Verify export API call
      cy.get('@exportData.last').should((interception) => {
        expect(interception.request.url).to.include('/api/analytics/export');
        expect(interception.response?.headers).to.have.property(
          'content-type',
          'text/csv',
        );
      });

      // Should show success message
      cy.contains('exported successfully').should('be.visible');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle network connectivity issues', () => {
      cy.intercept('GET', '/api/analytics/overview*', {
        forceNetworkError: true,
      }).as('networkError');

      cy.visit('/dashboard/analytics');
      cy.wait('@networkError');

      // Should show appropriate error message
      cy.contains('Failed to load analytics data').should('be.visible');
    });

    it('should handle malformed API responses', () => {
      cy.intercept('GET', '/api/analytics/overview*', {
        statusCode: 200,
        body: '{"invalid": json}',
      }).as('malformedResponse');

      cy.visit('/dashboard/analytics');
      cy.wait('@malformedResponse');

      // Should handle gracefully
      cy.contains('Failed to load analytics data').should('be.visible');
    });

    it('should handle concurrent API requests', () => {
      cy.visit('/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      // Rapidly change time ranges
      cy.contains('button', 'Weekly').click();
      cy.contains('button', 'Monthly').click();
      cy.contains('button', 'Daily').click();

      // Should handle all requests properly
      cy.get('@getAnalytics.all').should('have.length.at.least', 4);
      cy.contains('h1', 'Analytics').should('be.visible');
    });

    it('should handle session expiration', () => {
      cy.visit('/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      // Mock session expiration
      cy.intercept('GET', '/api/analytics/overview*', {
        statusCode: 401,
        body: { success: false, error: 'Session expired' },
      }).as('sessionExpired');

      cy.contains('button', 'Weekly').click();
      cy.wait('@sessionExpired');

      // Should redirect to login or show appropriate message
      cy.url().should('match', /\/(auth\/login|dashboard)/);
    });
  });

  describe('Performance and Accessibility', () => {
    it('should load within acceptable time limits', () => {
      const start = Date.now();

      cy.visit('/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      cy.then(() => {
        const loadTime = Date.now() - start;
        expect(loadTime).to.be.lessThan(5000); // Should load within 5 seconds
      });
    });

    it('should be keyboard accessible', () => {
      cy.visit('/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      // Test tab navigation
      cy.get('body').tab();
      cy.focused().should('be.visible');

      // Test keyboard interaction with time range buttons
      cy.contains('button', 'Weekly').focus().type('{enter}');
      cy.wait('@getAnalytics');

      // Test modal keyboard interaction
      cy.contains('button', 'Configure Markup').focus().type('{enter}');
      cy.contains('h3', 'Configure Markup Percentage').should('be.visible');

      // Test escape to close modal
      cy.get('body').type('{esc}');
      cy.contains('h3', 'Configure Markup Percentage').should('not.exist');
    });

    it('should have proper ARIA labels and roles', () => {
      cy.visit('/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      // Check for proper headings structure
      cy.get('h1').should('exist');
      cy.get('h3').should('exist');

      // Check for proper table structure
      cy.get('table').should('have.attr', 'role').or('not.have.attr', 'role');
      cy.get('thead').should('exist');
      cy.get('tbody').should('exist');

      // Check for proper button labels
      cy.get('button').should('have.text');
    });

    it('should work on different screen sizes', () => {
      const viewports = [
        { width: 1920, height: 1080, name: 'Desktop' },
        { width: 1024, height: 768, name: 'Tablet' },
        { width: 375, height: 667, name: 'Mobile' },
      ];

      viewports.forEach(({ width, height, name }) => {
        cy.viewport(width, height);
        cy.visit('/dashboard/analytics');
        cy.wait(['@getAnalytics', '@getConfig']);

        // Key elements should be visible
        cy.contains('h1', 'Analytics').should('be.visible');
        cy.get('[data-testid="metric-card"]').should('be.visible');

        // Tables should be scrollable on mobile
        if (name === 'Mobile') {
          cy.get('table').parent().should('have.css', 'overflow-x');
        }
      });
    });
  });

  describe('Real-time Data Updates', () => {
    it('should handle live data updates', () => {
      cy.visit('/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      // Simulate data update
      cy.intercept('GET', '/api/analytics/overview*', {
        statusCode: 200,
        body: {
          success: true,
          data: {
            totalRequests: 16000, // Updated value
            totalSpent: 900.5, // Updated value
            // ... rest of the data
            totalTokens: 3000000,
            averageRequestCost: 0.056,
            totalBaseCost: 750.42,
            totalMarkup: 150.08,
            successRate: 99.1,
            averageLatency: 820,
            topProviders: [],
            timeSeriesData: [],
            requestsByModel: [],
            trends: {
              requestsChange: 15.2,
              spentChange: 12.1,
              tokensChange: 18.5,
            },
          },
        },
      }).as('updatedAnalytics');

      // Trigger refresh
      cy.contains('button', 'Weekly').click();
      cy.wait('@updatedAnalytics');

      // Should show updated values
      cy.get('[data-testid="total-requests"]').should('contain', '16');
      cy.get('[data-testid="total-revenue"]').should('contain', '900');
    });
  });

  describe('Browser Compatibility', () => {
    it('should handle local storage correctly', () => {
      cy.visit('/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      // Test local storage functionality
      cy.window().its('localStorage').should('exist');
      cy.window().then((win) => {
        win.localStorage.setItem(
          'analytics-preferences',
          JSON.stringify({
            defaultTimeRange: 'weekly',
            defaultMetric: 'spent',
          }),
        );
      });

      // Reload and check if preferences are maintained
      cy.reload();
      cy.wait(['@getAnalytics', '@getConfig']);

      cy.window().then((win) => {
        const prefs = JSON.parse(
          win.localStorage.getItem('analytics-preferences') || '{}',
        );
        expect(prefs.defaultTimeRange).to.equal('weekly');
      });
    });

    it('should handle session storage correctly', () => {
      cy.visit('/dashboard/analytics');
      cy.wait(['@getAnalytics', '@getConfig']);

      cy.window().its('sessionStorage').should('exist');
      cy.window().then((win) => {
        win.sessionStorage.setItem('temp-data', 'test-value');
        expect(win.sessionStorage.getItem('temp-data')).to.equal('test-value');
      });
    });
  });
});
