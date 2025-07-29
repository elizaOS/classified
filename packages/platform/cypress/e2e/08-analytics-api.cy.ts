describe('Analytics & API Documentation - Complete Test Suite', () => {
  beforeEach(() => {
    // Set up authenticated user state
    cy.window().then((win) => {
      win.localStorage.setItem('auth-token', 'mock-token');
    });

    // Mock authenticated user check
    cy.intercept('GET', '**/auth/identity', {
      statusCode: 200,
      body: {
        user: {
          id: 'test-user-id',
          email: 'test@elizaos.ai',
          name: 'Test User',
        },
      },
    }).as('authCheck');
  });

  describe('Analytics Dashboard', () => {
    beforeEach(() => {
      // Mock analytics data
      cy.intercept('GET', '**/analytics/overview', {
        statusCode: 200,
        body: {
          totalRequests: 15420,
          successRate: 98.5,
          avgResponseTime: 245,
          activeAgents: 8,
          dailyStats: [
            { date: '2024-01-01', requests: 1200, errors: 15 },
            { date: '2024-01-02', requests: 1350, errors: 8 },
            { date: '2024-01-03', requests: 1100, errors: 12 },
          ],
          topEndpoints: [
            { endpoint: '/api/v1/agents', requests: 3240, avgTime: 120 },
            { endpoint: '/api/v1/generation', requests: 2890, avgTime: 1200 },
            { endpoint: '/api/v1/messages', requests: 1670, avgTime: 85 },
          ],
        },
      }).as('analyticsOverview');

      cy.visit('/dashboard/analytics');
      cy.wait(['@authCheck', '@analyticsOverview']);
    });

    it('should display analytics overview correctly', () => {
      cy.url().should('include', '/dashboard/analytics');

      // Check main metrics
      cy.contains('15,420').should('be.visible'); // Total requests
      cy.contains('98.5%').should('be.visible'); // Success rate
      cy.contains('245ms').should('be.visible'); // Avg response time
      cy.contains('8').should('be.visible'); // Active agents

      // Check charts are present
      cy.get('[data-cy="requests-chart"]').should('be.visible');
      cy.get('[data-cy="performance-chart"]').should('be.visible');
    });

    it('should display top endpoints table', () => {
      // Check endpoints table
      cy.contains('Top Endpoints').should('be.visible');
      cy.contains('/api/v1/agents').should('be.visible');
      cy.contains('/api/v1/generation').should('be.visible');
      cy.contains('/api/v1/messages').should('be.visible');

      // Check request counts
      cy.contains('3,240').should('be.visible');
      cy.contains('2,890').should('be.visible');
      cy.contains('1,670').should('be.visible');
    });

    it('should handle date range filtering', () => {
      // Test date range picker
      cy.get('[data-cy="date-range-picker"]').click();
      cy.get('[data-cy="last-7-days"]').click();

      // Mock filtered data
      cy.intercept('GET', '**/analytics/overview?range=7d', {
        statusCode: 200,
        body: {
          totalRequests: 8500,
          successRate: 99.1,
          avgResponseTime: 230,
          activeAgents: 8,
        },
      }).as('filteredAnalytics');

      cy.wait('@filteredAnalytics');

      // Should update displayed metrics
      cy.contains('8,500').should('be.visible');
      cy.contains('99.1%').should('be.visible');
      cy.contains('230ms').should('be.visible');
    });

    it('should handle analytics export', () => {
      // Test export functionality
      cy.get('button').contains('Export Report').click();

      // Select export options
      cy.get('[data-cy="export-modal"]').within(() => {
        cy.get('select[name="format"]').select('csv');
        cy.get('select[name="timeRange"]').select('30d');
        cy.get('button').contains('Export').click();
      });

      // Mock export API
      cy.intercept('GET', '**/analytics/export*', {
        statusCode: 200,
        headers: {
          'content-type': 'text/csv',
          'content-disposition': 'attachment; filename=analytics-report.csv',
        },
        body: 'date,requests,errors\n2024-01-01,1200,15',
      }).as('exportAnalytics');

      cy.wait('@exportAnalytics');
    });
  });

  describe('API Documentation', () => {
    beforeEach(() => {
      cy.visit('/api-docs');
      cy.wait('@authCheck');
    });

    it('should display API documentation page', () => {
      cy.url().should('include', '/api-docs');

      // Check page structure
      cy.contains('API Documentation').should('be.visible');
      cy.contains('ElizaOS Platform API').should('be.visible');

      // Check navigation sidebar
      cy.get('[data-cy="api-nav"]').should('be.visible');
      cy.contains('Authentication').should('be.visible');
      cy.contains('Agents').should('be.visible');
      cy.contains('Generation').should('be.visible');
      cy.contains('Messages').should('be.visible');
    });

    it('should display authentication documentation', () => {
      // Navigate to authentication section
      cy.get('a[href="#authentication"]').click();
      cy.get('#authentication').should('be.visible');

      // Check authentication content
      cy.contains('API Key Authentication').should('be.visible');
      cy.contains('Authorization: Bearer').should('be.visible');

      // Check code examples
      cy.get('code')
        .contains('Authorization: Bearer your-api-key')
        .should('be.visible');
    });

    it('should display agents API documentation', () => {
      // Navigate to agents section
      cy.get('a[href="#agents"]').click();
      cy.get('#agents').should('be.visible');

      // Check endpoint documentation
      cy.contains('GET /api/v1/agents').should('be.visible');
      cy.contains('POST /api/v1/agents').should('be.visible');
      cy.contains('PUT /api/v1/agents/{id}').should('be.visible');
      cy.contains('DELETE /api/v1/agents/{id}').should('be.visible');

      // Check request/response examples
      cy.contains('Request Body').should('be.visible');
      cy.contains('Response').should('be.visible');
    });

    it('should display generation API documentation', () => {
      // Navigate to generation section
      cy.get('a[href="#generation"]').click();
      cy.get('#generation').should('be.visible');

      // Check generation endpoints
      cy.contains('POST /api/v1/generation').should('be.visible');
      cy.contains('GET /api/v1/generation/{id}').should('be.visible');

      // Check parameters
      cy.contains('prompt').should('be.visible');
      cy.contains('model').should('be.visible');
      cy.contains('temperature').should('be.visible');
    });

    it('should have interactive API explorer', () => {
      // Check if Swagger UI is loaded
      cy.get('.swagger-ui').should('be.visible');

      // Test API endpoint expansion
      cy.get('[data-cy="agents-endpoint"]').click();
      cy.get('[data-cy="try-it-out"]').should('be.visible');

      // Test API key input
      cy.get('input[placeholder*="api-key"]').should('be.visible');
    });

    it('should handle API testing', () => {
      // Navigate to a specific endpoint
      cy.get('[data-cy="agents-get-endpoint"]').click();
      cy.get('[data-cy="try-it-out"]').click();

      // Mock API response for testing
      cy.intercept('GET', '**/api/v1/agents', {
        statusCode: 200,
        body: {
          agents: [{ id: 'agent-1', name: 'Test Agent', status: 'active' }],
        },
      }).as('testApiCall');

      // Execute API call
      cy.get('[data-cy="execute"]').click();
      cy.wait('@testApiCall');

      // Check response display
      cy.contains('200').should('be.visible');
      cy.contains('Test Agent').should('be.visible');
    });
  });

  describe('Usage Analytics', () => {
    beforeEach(() => {
      // Mock detailed usage data
      cy.intercept('GET', '**/analytics/detailed', {
        statusCode: 200,
        body: {
          creditUsage: {
            total: 2450,
            byType: {
              text: 1200,
              image: 800,
              video: 450,
            },
            daily: [
              { date: '2024-01-01', credits: 150 },
              { date: '2024-01-02', credits: 200 },
              { date: '2024-01-03', credits: 180 },
            ],
          },
          apiUsage: {
            totalCalls: 15420,
            byEndpoint: {
              '/api/v1/generation': 8500,
              '/api/v1/agents': 4200,
              '/api/v1/messages': 2720,
            },
          },
          errorAnalysis: {
            totalErrors: 45,
            byType: {
              '400': 20,
              '401': 15,
              '500': 10,
            },
          },
        },
      }).as('detailedAnalytics');

      cy.visit('/dashboard/analytics?view=detailed');
      cy.wait(['@authCheck', '@detailedAnalytics']);
    });

    it('should display credit usage analytics', () => {
      // Check credit usage section
      cy.contains('Credit Usage').should('be.visible');
      cy.contains('2,450 credits').should('be.visible');

      // Check breakdown by type
      cy.contains('Text: 1,200').should('be.visible');
      cy.contains('Image: 800').should('be.visible');
      cy.contains('Video: 450').should('be.visible');

      // Check chart
      cy.get('[data-cy="credit-usage-chart"]').should('be.visible');
    });

    it('should display API usage analytics', () => {
      // Check API usage section
      cy.contains('API Usage').should('be.visible');
      cy.contains('15,420 calls').should('be.visible');

      // Check endpoint breakdown
      cy.contains('/api/v1/generation: 8,500').should('be.visible');
      cy.contains('/api/v1/agents: 4,200').should('be.visible');
      cy.contains('/api/v1/messages: 2,720').should('be.visible');
    });

    it('should display error analysis', () => {
      // Check error analysis section
      cy.contains('Error Analysis').should('be.visible');
      cy.contains('45 errors').should('be.visible');

      // Check error breakdown
      cy.contains('400 Bad Request: 20').should('be.visible');
      cy.contains('401 Unauthorized: 15').should('be.visible');
      cy.contains('500 Internal Server Error: 10').should('be.visible');
    });

    it('should handle real-time analytics updates', () => {
      // Mock WebSocket connection for real-time updates
      cy.window().then((win) => {
        // Simulate real-time update
        const mockUpdate = {
          totalRequests: 15421,
          newErrors: 1,
        };

        // Trigger update event
        win.dispatchEvent(
          new CustomEvent('analytics-update', { detail: mockUpdate }),
        );
      });

      // Should update displayed metrics
      cy.contains('15,421').should('be.visible');
    });
  });

  describe('Agent Performance Analytics', () => {
    beforeEach(() => {
      // Mock agent performance data
      cy.intercept('GET', '**/analytics/agent-performance', {
        statusCode: 200,
        body: {
          agents: [
            {
              id: 'agent-1',
              name: 'Support Bot',
              metrics: {
                totalConversations: 245,
                avgResponseTime: 850,
                satisfactionScore: 4.7,
                uptime: 99.2,
              },
            },
            {
              id: 'agent-2',
              name: 'Sales Assistant',
              metrics: {
                totalConversations: 189,
                avgResponseTime: 620,
                satisfactionScore: 4.5,
                uptime: 98.8,
              },
            },
          ],
        },
      }).as('agentPerformance');

      cy.visit('/dashboard/analytics?view=agents');
      cy.wait(['@authCheck', '@agentPerformance']);
    });

    it('should display agent performance metrics', () => {
      // Check agent performance table
      cy.contains('Agent Performance').should('be.visible');

      // Check individual agent metrics
      cy.contains('Support Bot').should('be.visible');
      cy.contains('245').should('be.visible'); // conversations
      cy.contains('850ms').should('be.visible'); // response time
      cy.contains('4.7').should('be.visible'); // satisfaction
      cy.contains('99.2%').should('be.visible'); // uptime

      cy.contains('Sales Assistant').should('be.visible');
      cy.contains('189').should('be.visible');
      cy.contains('620ms').should('be.visible');
      cy.contains('4.5').should('be.visible');
      cy.contains('98.8%').should('be.visible');
    });

    it('should handle agent performance sorting', () => {
      // Test sorting by different metrics
      cy.get('th').contains('Response Time').click();

      // Should sort by response time
      cy.get('tbody tr').first().should('contain', 'Sales Assistant'); // 620ms is faster

      cy.get('th').contains('Satisfaction').click();

      // Should sort by satisfaction score
      cy.get('tbody tr').first().should('contain', 'Support Bot'); // 4.7 is higher
    });

    it('should display agent performance charts', () => {
      // Check performance charts
      cy.get('[data-cy="response-time-chart"]').should('be.visible');
      cy.get('[data-cy="satisfaction-chart"]').should('be.visible');
      cy.get('[data-cy="uptime-chart"]').should('be.visible');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle analytics data loading errors', () => {
      cy.intercept('GET', '**/analytics/overview', {
        statusCode: 500,
        body: { error: 'Analytics service unavailable' },
      }).as('analyticsError');

      cy.visit('/dashboard/analytics');
      cy.wait(['@authCheck', '@analyticsError']);

      // Should show error state
      cy.contains('Error loading analytics').should('be.visible');
      cy.get('button').contains('Retry').should('be.visible');
    });

    it('should handle empty analytics data', () => {
      cy.intercept('GET', '**/analytics/overview', {
        statusCode: 200,
        body: {
          totalRequests: 0,
          successRate: 0,
          avgResponseTime: 0,
          activeAgents: 0,
          dailyStats: [],
          topEndpoints: [],
        },
      }).as('emptyAnalytics');

      cy.visit('/dashboard/analytics');
      cy.wait(['@authCheck', '@emptyAnalytics']);

      // Should show empty state
      cy.contains('No data available').should('be.visible');
      cy.contains('Start using the API to see analytics').should('be.visible');
    });

    it('should handle API documentation loading failures', () => {
      // Mock failed OpenAPI spec loading
      cy.intercept('GET', '**/openapi.yaml', {
        statusCode: 404,
        body: 'Not found',
      }).as('openApiError');

      cy.visit('/api-docs');
      cy.wait(['@authCheck', '@openApiError']);

      // Should show fallback documentation
      cy.contains('API documentation temporarily unavailable').should(
        'be.visible',
      );
      cy.contains('Basic API Guide').should('be.visible');
    });
  });

  describe('Responsive Design and Accessibility', () => {
    it('should work on mobile devices', () => {
      cy.viewport(375, 667); // iPhone SE

      cy.visit('/dashboard/analytics');
      cy.wait('@authCheck');

      // Analytics cards should stack vertically
      cy.contains('Total Requests').should('be.visible');
      cy.contains('Success Rate').should('be.visible');

      // Charts should be responsive
      cy.get('[data-cy="requests-chart"]').should('be.visible');
    });

    it('should support keyboard navigation', () => {
      cy.visit('/api-docs');
      cy.wait('@authCheck');

      // Should be able to navigate API sections with keyboard
      cy.get('a[href="#authentication"]').focus();
      cy.focused().should('contain', 'Authentication');

      cy.tab();
      cy.focused().should('contain', 'Agents');
    });

    it('should have proper ARIA labels', () => {
      cy.visit('/dashboard/analytics');
      cy.wait('@authCheck');

      // Charts should have proper labeling
      cy.get('[data-cy="requests-chart"]')
        .should('have.attr', 'aria-label')
        .or('have.attr', 'role');

      // Tables should have proper structure
      cy.get('table')
        .should('have.attr', 'aria-label')
        .or('have.attr', 'role', 'table');
    });
  });
});
