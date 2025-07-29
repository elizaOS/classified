describe('Dashboard', () => {
  beforeEach(() => {
    cy.loginAsTestUser();
  });

  describe('Dashboard Overview', () => {
    it('should display dashboard correctly', () => {
      cy.visit('/dashboard');

      // Check main dashboard elements
      cy.get('[data-cy="dashboard-header"]').should('be.visible');
      cy.get('[data-cy="stats-section"]').should('be.visible');
      cy.get('[data-cy="agents-overview"]').should('be.visible');
      cy.get('[data-cy="recent-activity"]').should('be.visible');
      cy.get('[data-cy="quick-actions"]').should('be.visible');
    });

    it('should display user stats correctly', () => {
      // Mock dashboard data
      cy.mockApiSuccess('GET', 'dashboard/stats', {
        totalAgents: 5,
        activeAgents: 3,
        totalInteractions: 12450,
        monthlyGrowth: 23.5,
        creditBalance: 125.5,
        avgResponseTime: 0.85,
      });

      cy.visit('/dashboard');

      // Check stats cards
      cy.get('[data-cy="stat-total-agents"]').should('contain', '5');
      cy.get('[data-cy="stat-active-agents"]').should('contain', '3');
      cy.get('[data-cy="stat-interactions"]').should('contain', '12,450');
      cy.get('[data-cy="stat-credit-balance"]').should('contain', '$125.50');
      cy.get('[data-cy="stat-response-time"]').should('contain', '0.85s');
      cy.get('[data-cy="stat-growth"]').should('contain', '+23.5%');
    });

    it('should display recent activity', () => {
      cy.mockApiSuccess('GET', 'dashboard/activity', [
        {
          id: '1',
          type: 'agent_created',
          title: 'New agent created',
          description: 'Customer Support Bot was created',
          timestamp: new Date().toISOString(),
          icon: 'bot',
        },
        {
          id: '2',
          type: 'agent_deployed',
          title: 'Agent deployed',
          description: 'FAQ Bot is now live',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
          icon: 'rocket',
        },
      ]);

      cy.visit('/dashboard');

      cy.get('[data-cy="activity-list"]').within(() => {
        cy.get('[data-cy="activity-item"]').should('have.length.at.least', 2);
        cy.get('[data-cy="activity-item"]')
          .first()
          .should('contain', 'Customer Support Bot');
      });
    });

    it('should display agent overview cards', () => {
      cy.mockApiSuccess('GET', 'agents', {
        agents: [
          {
            id: 'agent-1',
            name: 'Customer Support Bot',
            status: 'active',
            interactions: 5250,
            lastActive: new Date().toISOString(),
            performance: 95,
          },
          {
            id: 'agent-2',
            name: 'FAQ Bot',
            status: 'active',
            interactions: 3200,
            lastActive: new Date(Date.now() - 1800000).toISOString(),
            performance: 88,
          },
          {
            id: 'agent-3',
            name: 'Sales Assistant',
            status: 'draft',
            interactions: 0,
            lastActive: null,
            performance: 0,
          },
        ],
      });

      cy.visit('/dashboard');

      cy.get('[data-cy="agent-card"]').should('have.length', 3);
      cy.get('[data-cy="agent-card"]')
        .first()
        .within(() => {
          cy.get('[data-cy="agent-name"]').should(
            'contain',
            'Customer Support Bot',
          );
          cy.get('[data-cy="agent-status"]').should(
            'have.class',
            'status-active',
          );
          cy.get('[data-cy="agent-interactions"]').should('contain', '5,250');
          cy.get('[data-cy="agent-performance"]').should('contain', '95%');
        });
    });
  });

  describe('Quick Actions', () => {
    it('should navigate to create agent', () => {
      cy.visit('/dashboard');
      cy.get('[data-cy="quick-action-create-agent"]').click();
      cy.url().should('include', '/agents/new');
    });

    it('should navigate to billing', () => {
      cy.visit('/dashboard');
      cy.get('[data-cy="quick-action-add-credits"]').click();
      cy.url().should('include', '/billing');
    });

    it('should navigate to documentation', () => {
      cy.visit('/dashboard');
      cy.get('[data-cy="quick-action-docs"]').click();

      // Should open in new tab
      cy.window().its('open').should('be.called');
    });
  });

  describe('Notifications', () => {
    it('should display notification bell with count', () => {
      cy.mockApiSuccess('GET', 'notifications/unread-count', { count: 3 });

      cy.visit('/dashboard');
      cy.get('[data-cy="notification-bell"]').should('be.visible');
      cy.get('[data-cy="notification-count"]').should('contain', '3');
    });

    it('should show notification dropdown', () => {
      cy.mockApiSuccess('GET', 'notifications', {
        notifications: [
          {
            id: '1',
            type: 'warning',
            title: 'Low Credit Balance',
            message: 'Your credit balance is below $10',
            timestamp: new Date().toISOString(),
            read: false,
          },
          {
            id: '2',
            type: 'info',
            title: 'Agent Update Available',
            message: 'New features available for your agents',
            timestamp: new Date(Date.now() - 7200000).toISOString(),
            read: false,
          },
        ],
      });

      cy.visit('/dashboard');
      cy.get('[data-cy="notification-bell"]').click();

      cy.get('[data-cy="notification-dropdown"]').should('be.visible');
      cy.get('[data-cy="notification-item"]').should('have.length', 2);
      cy.get('[data-cy="notification-item"]')
        .first()
        .should('contain', 'Low Credit Balance');
    });

    it('should mark notification as read', () => {
      cy.mockApiSuccess('GET', 'notifications', {
        notifications: [
          {
            id: '1',
            type: 'info',
            title: 'Test Notification',
            message: 'Test message',
            timestamp: new Date().toISOString(),
            read: false,
          },
        ],
      });

      cy.mockApiSuccess('PUT', 'notifications/1/read', { success: true });

      cy.visit('/dashboard');
      cy.get('[data-cy="notification-bell"]').click();
      cy.get('[data-cy="notification-item"]').first().click();

      // Should mark as read
      cy.get('[data-cy="notification-item"]')
        .first()
        .should('have.class', 'read');
    });
  });

  describe('Search Functionality', () => {
    it('should search across agents', () => {
      cy.visit('/dashboard');

      cy.get('[data-cy="dashboard-search"]').type('customer');

      // Mock search results
      cy.mockApiSuccess('GET', 'search?q=customer', {
        results: [
          {
            type: 'agent',
            id: 'agent-1',
            name: 'Customer Support Bot',
            description: 'Handles customer inquiries',
          },
        ],
      });

      cy.get('[data-cy="search-results"]').should('be.visible');
      cy.get('[data-cy="search-result-item"]').should(
        'contain',
        'Customer Support Bot',
      );
    });
  });

  describe('User Menu', () => {
    it('should display user information', () => {
      cy.visit('/dashboard');

      cy.get('[data-cy="user-menu"]').click();
      cy.get('[data-cy="user-dropdown"]').should('be.visible');
      cy.get('[data-cy="user-name"]').should('contain', 'Test User');
      cy.get('[data-cy="user-email"]').should('contain', 'test@elizaos.ai');
      cy.get('[data-cy="user-role"]').should('contain', 'Owner');
    });

    it('should navigate to profile settings', () => {
      cy.visit('/dashboard');

      cy.get('[data-cy="user-menu"]').click();
      cy.get('[data-cy="profile-link"]').click();
      cy.url().should('include', '/settings/profile');
    });

    it('should navigate to organization settings', () => {
      cy.visit('/dashboard');

      cy.get('[data-cy="user-menu"]').click();
      cy.get('[data-cy="org-settings-link"]').click();
      cy.url().should('include', '/settings/organization');
    });
  });

  describe('Dashboard Widgets', () => {
    it('should display usage chart', () => {
      cy.mockApiSuccess('GET', 'dashboard/usage-chart', {
        labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
        datasets: [
          {
            label: 'Interactions',
            data: [120, 190, 150, 220, 180, 240, 210],
          },
        ],
      });

      cy.visit('/dashboard');
      cy.get('[data-cy="usage-chart"]').should('be.visible');
      cy.get('[data-cy="chart-canvas"]').should('exist');
    });

    it('should display credit usage breakdown', () => {
      cy.mockApiSuccess('GET', 'dashboard/credit-usage', {
        breakdown: [
          { category: 'GPT-4', amount: 45.2, percentage: 35 },
          { category: 'Claude', amount: 32.1, percentage: 25 },
          { category: 'Storage', amount: 25.7, percentage: 20 },
          { category: 'Other', amount: 25.5, percentage: 20 },
        ],
      });

      cy.visit('/dashboard');
      cy.get('[data-cy="credit-breakdown"]').should('be.visible');
      cy.get('[data-cy="breakdown-item"]').should('have.length', 4);
      cy.get('[data-cy="breakdown-item"]').first().should('contain', 'GPT-4');
      cy.get('[data-cy="breakdown-item"]').first().should('contain', '$45.20');
    });
  });

  describe('Dashboard Responsiveness', () => {
    it('should adapt to mobile viewport', () => {
      cy.viewport('iphone-x');
      cy.visit('/dashboard');

      // Mobile menu should be visible
      cy.get('[data-cy="mobile-menu-toggle"]').should('be.visible');

      // Stats should stack vertically
      cy.get('[data-cy="stats-section"]').should(
        'have.css',
        'flex-direction',
        'column',
      );
    });

    it('should adapt to tablet viewport', () => {
      cy.viewport('ipad-2');
      cy.visit('/dashboard');

      // Should show condensed layout
      cy.get('[data-cy="agent-card"]')
        .should('have.css', 'width')
        .and('match', /^(49|50)%/);
    });
  });

  describe('Dashboard Filters', () => {
    it('should filter by time period', () => {
      cy.visit('/dashboard');

      cy.get('[data-cy="time-filter"]').click();
      cy.get('[data-cy="filter-7days"]').click();

      // Should update stats
      cy.mockApiSuccess('GET', 'dashboard/stats?period=7days', {
        totalAgents: 5,
        activeAgents: 3,
        totalInteractions: 1245,
        monthlyGrowth: 15.2,
        creditBalance: 125.5,
        avgResponseTime: 0.92,
      });

      cy.get('[data-cy="stat-interactions"]').should('contain', '1,245');
    });

    it('should filter agents by status', () => {
      cy.visit('/dashboard');

      cy.get('[data-cy="agent-filter"]').click();
      cy.get('[data-cy="filter-active"]').click();

      // Should only show active agents
      cy.get('[data-cy="agent-card"]').each(($el) => {
        cy.wrap($el)
          .find('[data-cy="agent-status"]')
          .should('have.class', 'status-active');
      });
    });
  });

  describe('Dashboard Error States', () => {
    it('should handle loading state', () => {
      // Delay the response
      cy.intercept('GET', '**/api/dashboard/stats', (req) => {
        req.reply((res) => {
          res.delay(1000);
          res.send({
            totalAgents: 5,
            activeAgents: 3,
            totalInteractions: 12450,
            monthlyGrowth: 23.5,
            creditBalance: 125.5,
            avgResponseTime: 0.85,
          });
        });
      });

      cy.visit('/dashboard');
      cy.get('[data-cy="loading-skeleton"]').should('be.visible');
      cy.get('[data-cy="stats-section"]').should('be.visible');
    });

    it('should handle API errors gracefully', () => {
      cy.mockApiError(
        'GET',
        'dashboard/stats',
        'Failed to load dashboard data',
        500,
      );

      cy.visit('/dashboard');
      cy.get('[data-cy="error-message"]').should(
        'contain',
        'Failed to load dashboard data',
      );
      cy.get('[data-cy="retry-button"]').should('be.visible');
    });

    it('should retry failed requests', () => {
      let attempts = 0;
      cy.intercept('GET', '**/api/dashboard/stats', (req) => {
        attempts++;
        if (attempts === 1) {
          req.reply({ statusCode: 500 });
        } else {
          req.reply({
            totalAgents: 5,
            activeAgents: 3,
            totalInteractions: 12450,
            monthlyGrowth: 23.5,
            creditBalance: 125.5,
            avgResponseTime: 0.85,
          });
        }
      });

      cy.visit('/dashboard');
      cy.get('[data-cy="error-message"]').should('be.visible');
      cy.get('[data-cy="retry-button"]').click();
      cy.get('[data-cy="stats-section"]').should('be.visible');
    });
  });
});
